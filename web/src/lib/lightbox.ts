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
 * 统一多图/单图全屏 Lightbox 查看器
 * 支持：多图切换、手势滑动、下拉关闭、键盘控制、前后图预加载、张数指示器
 */
export function openMultiImageLightbox(options: OpenLightboxOptions | string) {
  const normalizedImages: LightboxImageItem[] =
    typeof options === "string"
      ? [{ src: options }]
      : options.images.map((item) => (typeof item === "string" ? { src: item } : item));

  if (normalizedImages.length === 0) return;

  let currentIndex = typeof options === "object" && options.initialIndex ? options.initialIndex : 0;
  if (currentIndex < 0) currentIndex = 0;
  if (currentIndex >= normalizedImages.length) currentIndex = normalizedImages.length - 1;

  const onIndexChange = typeof options === "object" ? options.onIndexChange : undefined;

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
    const cur = normalizedImages[currentIndex];
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

    if (normalizedImages.length > 1) {
      counter.textContent = `${currentIndex + 1} / ${normalizedImages.length}`;
      counter.style.display = "inline-flex";
      prevBtn.style.display = currentIndex > 0 ? "flex" : "none";
      nextBtn.style.display = currentIndex < normalizedImages.length - 1 ? "flex" : "none";
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
      p.src = normalizedImages[currentIndex - 1].src;
    }
    if (currentIndex < normalizedImages.length - 1) {
      const n = new Image();
      n.src = normalizedImages[currentIndex + 1].src;
    }

    onIndexChange?.(currentIndex);
  };

  const goTo = (nextIndex: number, dir?: "left" | "right") => {
    if (nextIndex < 0 || nextIndex >= normalizedImages.length) return;
    currentIndex = nextIndex;
    updateView(dir);
  };

  const goPrev = () => {
    if (currentIndex > 0) goTo(currentIndex - 1, "left");
  };

  const goNext = () => {
    if (currentIndex < normalizedImages.length - 1) goTo(currentIndex + 1, "right");
  };

  const close = () => {
    document.removeEventListener("keydown", onKeyDown, true);
    if (dialog.open) {
      dialog.close();
    }
    dialog.remove();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    }
  };

  closeBtn.addEventListener("click", close);
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
      close();
    }
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    close();
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
    } else if (normalizedImages.length > 1) {
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
      setTimeout(close, 200);
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
  if (normalizedImages.length > 1) {
    content.appendChild(prevBtn);
    content.appendChild(nextBtn);
  }
  content.appendChild(captionEl);
  dialog.appendChild(content);

  document.body.appendChild(dialog);
  updateView();
  dialog.showModal();
  content.focus();
}
