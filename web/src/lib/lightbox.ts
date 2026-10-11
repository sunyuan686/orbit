export interface LightboxImageItem {
  src: string;
  alt?: string;
  caption?: string;
  title?: string;
  width?: number | null;
  height?: number | null;
}

export interface OpenLightboxOptions {
  images: LightboxImageItem[] | string[];
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
}

/**
 * 灯箱载荷：图集与当前张由打开方直接带入。
 *
 * 刻意不放进 URL。正文多图的图集是运行时数组（`MultiImageDeck` 从节点 attrs 取），
 * 无法从单个 id 反推；正文图片节点也只存 `src`（`/assets/<storageKey>.<ext>`），不存
 * assetId。因此"URL 即状态"在这里会退化成"从 URL 猜内容"，代价高于收益。
 */
export interface LightboxPayload {
  images: LightboxImageItem[];
  initialIndex: number;
  onIndexChange?: (index: number) => void;
}

interface LightboxHost {
  open: (payload: LightboxPayload) => void;
}

/**
 * 宿主注册表。
 *
 * `extensions/OrbitImage.ts` 是原生 DOM NodeView（`document.createElement`），拿不到
 * React hook，也没有 router 上下文。它只有"打开某张图"这一个意图要表达，所以通道收敛为
 * 一个模块级函数：宿主（`<LightboxHost/>`）挂载时注册、卸载时注销；调用方只调
 * `openMultiImageLightbox`，不关心灯箱最终由谁渲染。
 *
 * 灯箱自身"开没开"仍由 location 派生（宿主内部用 `useLayer`），这里传的只是"看什么"。
 */
let host: LightboxHost | null = null;

export function attachLightboxHost(next: LightboxHost): () => void {
  host = next;
  return () => {
    if (host === next) host = null;
  };
}

function resolvePayload(options: OpenLightboxOptions | string): LightboxPayload | null {
  const raw = typeof options === "string" ? [options] : options.images;
  const images: LightboxImageItem[] = raw.map((item) =>
    typeof item === "string" ? { src: item } : item,
  );
  if (images.length === 0) return null;

  const requested = typeof options === "object" ? (options.initialIndex ?? 0) : 0;
  return {
    images,
    initialIndex: Math.min(Math.max(requested, 0), images.length - 1),
    onIndexChange: typeof options === "object" ? options.onIndexChange : undefined,
  };
}

/**
 * 统一多图/单图全屏 Lightbox 查看器的唯一入口。
 *
 * 支持：多图切换、手势滑动、下拉关闭、键盘控制、前后图预加载、张数指示器。
 */
export function openMultiImageLightbox(options: OpenLightboxOptions | string) {
  const payload = resolvePayload(options);
  if (!payload) return;
  // 宿主挂在路由之外，任何页面都在；未注册说明宿主没挂上，此时无声失败而非静默降级去改 DOM。
  host?.open(payload);
}

/**
 * 把灯箱的 DOM 挂到 body 上（`<dialog showModal>`，保证层级高于任何 React 浮层）。
 *
 * 关闭一律走 `onRequestClose`（宿主注入的层关闭 = `navigate(-1)`），本函数不自行判定
 * 生命周期：返回的 disposer 才是唯一的拆除路径，由宿主在层离栈时调用。这样"返回手势
 * 关灯箱"与"点关闭按钮"是同一条路（规则 3：关闭路径唯一收敛）。
 *
 * 保留 `<dialog>` 渲染的另一个原因：`EditorFullscreenOverlay` 用
 * `.orbit-image-lightbox-dialog[open]` 这个选择器判断"有内层浮层吃掉了 Esc"。
 */
export function mountLightboxDialog(
  payload: LightboxPayload,
  onRequestClose: () => void,
): () => void {
  const { images } = payload;
  let currentIndex = payload.initialIndex;

  const dialog = document.createElement("dialog");
  dialog.className = "orbit-image-lightbox-dialog";
  dialog.setAttribute("aria-label", "全屏图片预览");

  const content = document.createElement("div");
  content.className = "orbit-image-lightbox-content";
  content.tabIndex = -1;

  // 顶部工具栏（计数角标 + 关闭按钮）
  const topBar = document.createElement("div");
  topBar.className = "orbit-image-lightbox-topbar";

  const counter = document.createElement("span");
  counter.className = "orbit-image-lightbox-counter";
  topBar.appendChild(counter);

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "orbit-image-lightbox-close";
  closeBtn.title = "关闭全屏预览 (Esc)";
  closeBtn.setAttribute("aria-label", "关闭全屏预览");
  closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
  topBar.appendChild(closeBtn);

  // 图片展示区
  const imgWrap = document.createElement("div");
  imgWrap.className = "orbit-image-lightbox-img-wrap";

  const imgEl = document.createElement("img");
  imgEl.className = "orbit-image-lightbox-img";
  imgWrap.appendChild(imgEl);

  // 底部说明文字
  const captionEl = document.createElement("div");
  captionEl.className = "orbit-image-lightbox-caption";

  // 左右翻页按钮
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "orbit-image-lightbox-nav orbit-image-lightbox-nav--prev";
  prevBtn.title = "上一张 (←)";
  prevBtn.setAttribute("aria-label", "上一张图片");
  prevBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "orbit-image-lightbox-nav orbit-image-lightbox-nav--next";
  nextBtn.title = "下一张 (→)";
  nextBtn.setAttribute("aria-label", "下一张图片");
  nextBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

  const updateView = (animateDirection?: "left" | "right") => {
    const cur = images[currentIndex];
    if (!cur) return;

    if (animateDirection) {
      imgEl.style.transition = "none";
      imgEl.style.transform = animateDirection === "right" ? "translateX(24px)" : "translateX(-24px)";
      imgEl.style.opacity = "0.7";
      requestAnimationFrame(() => {
        imgEl.style.transition = "transform 0.22s ease-out, opacity 0.22s ease-out";
        imgEl.style.transform = "translateX(0)";
        imgEl.style.opacity = "1";
      });
    } else {
      imgEl.style.transform = "none";
      imgEl.style.opacity = "1";
    }

    imgEl.src = cur.src;
    imgEl.alt = cur.alt || cur.caption || "";

    if (images.length > 1) {
      counter.textContent = `${currentIndex + 1} / ${images.length}`;
      counter.style.display = "inline-flex";
      prevBtn.style.display = currentIndex > 0 ? "flex" : "none";
      nextBtn.style.display = currentIndex < images.length - 1 ? "flex" : "none";
    } else {
      counter.style.display = "none";
      prevBtn.style.display = "none";
      nextBtn.style.display = "none";
    }

    const text = cur.caption || cur.title || "";
    if (text) {
      captionEl.textContent = text;
      captionEl.style.display = "block";
    } else {
      captionEl.textContent = "";
      captionEl.style.display = "none";
    }

    // 预加载前后图片
    if (currentIndex > 0) {
      const p = new Image();
      p.src = images[currentIndex - 1].src;
    }
    if (currentIndex < images.length - 1) {
      const n = new Image();
      n.src = images[currentIndex + 1].src;
    }

    payload.onIndexChange?.(currentIndex);
  };

  const goTo = (nextIndex: number, dir?: "left" | "right") => {
    if (nextIndex < 0 || nextIndex >= images.length) return;
    currentIndex = nextIndex;
    updateView(dir);
  };

  const goPrev = () => {
    if (currentIndex > 0) goTo(currentIndex - 1, "left");
  };

  const goNext = () => {
    if (currentIndex < images.length - 1) goTo(currentIndex + 1, "right");
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onRequestClose();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  };

  closeBtn.addEventListener("click", onRequestClose);
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    goPrev();
  });
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    goNext();
  });

  // 点击遮罩区域退出
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target === content || e.target === imgWrap) {
      onRequestClose();
    }
  });
  // 原生 Esc（<dialog showModal>）改走同一条关闭路径
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    onRequestClose();
  });
  document.addEventListener("keydown", onKeyDown, true);

  // 移动端 Touch 手势：横向切图与下拉退出
  let touchStart: { x: number; y: number; time: number } | null = null;
  let touchOffset = { x: 0, y: 0 };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStart = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    imgWrap.style.transition = "none";
  };

  const onTouchMove = (e: TouchEvent) => {
    if (!touchStart || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStart.x;
    const deltaY = e.touches[0].clientY - touchStart.y;
    touchOffset = { x: deltaX, y: deltaY };

    // 下拉跟随
    if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
      imgWrap.style.transform = `translateY(${deltaY * 0.75}px) scale(${Math.max(0.85, 1 - deltaY / 800)})`;
      dialog.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(0.3, 0.9 - deltaY / 400)})`;
    } else if (images.length > 1) {
      // 阻尼水平拉动
      const dampedX = deltaX * 0.6;
      imgWrap.style.transform = `translateX(${dampedX}px)`;
    }
  };

  const onTouchEnd = () => {
    if (!touchStart) return;
    const { x: deltaX, y: deltaY, time } = { ...touchOffset, time: touchStart.time };
    const duration = Date.now() - time;
    touchStart = null;
    touchOffset = { x: 0, y: 0 };

    imgWrap.style.transition = "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1)";
    dialog.style.backgroundColor = "";

    // 下拉退出判定 (> 80px 且垂直位移明显)
    if (deltaY > 80 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2) {
      imgWrap.style.transform = `translateY(100vh)`;
      setTimeout(onRequestClose, 200);
      return;
    }

    imgWrap.style.transform = "none";

    // 水平滑屏切换
    const absX = Math.abs(deltaX);
    if (absX > 40 || (absX > 20 && duration < 250)) {
      if (deltaX < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
  };

  imgWrap.addEventListener("touchstart", onTouchStart, { passive: true });
  imgWrap.addEventListener("touchmove", onTouchMove, { passive: true });
  imgWrap.addEventListener("touchend", onTouchEnd, { passive: true });

  content.appendChild(topBar);
  content.appendChild(imgWrap);
  if (images.length > 1) {
    content.appendChild(prevBtn);
    content.appendChild(nextBtn);
  }
  content.appendChild(captionEl);
  dialog.appendChild(content);

  document.body.appendChild(dialog);
  document.documentElement.classList.add("orbit-lightbox-active");
  updateView();
  dialog.showModal();
  content.focus();

  const preventScroll = (e: TouchEvent) => {
    if (e.cancelable) e.preventDefault();
  };
  dialog.addEventListener("touchmove", preventScroll, { passive: false });

  return () => {
    document.documentElement.classList.remove("orbit-lightbox-active");
    dialog.removeEventListener("touchmove", preventScroll);
    document.removeEventListener("keydown", onKeyDown, true);
    if (dialog.open) dialog.close();
    dialog.remove();
  };
}
