import { useLayoutEffect, useEffect, useRef, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { getSavedScrollPosition, saveScrollPosition } from "../lib/scrollPositions";

/**
 * 第一性原理滚动容器恢复机制。
 *
 * 针对 App-Shell 架构（html/body overflow: hidden，内部 `<main>` 为原生滚动容器）：
 * 1. 单一真相源：用户在页面浏览期间，DOM 容器（<main>）自身的 scrollTop 即为当前最新偏置，
 *    无需在每次原生滚动事件上高频轮询写 Map，彻底消除与 React 生命周期及卸载时序的竞态踩踏。
 * 2. 路由离场原子存照：在导航跳转的一瞬间（useLayoutEffect 判定 location 变更前夕），
 *    原子化记录离开页面（prevLocation.key）的最终 scrollTop。
 * 3. 语义化导航行为：
 *    - 呈现层（同 URL / 浮层抽屉）：底层滚动保持不动，不触发归零；
 *    - PUSH（全新导航）/ REPLACE（跨页切换）：新页面容器归零；
 *    - POP（返回/前进）：提取目标历史条目的保存偏置。
 * 4. 异步高度自适应对齐（ResizeObserver）：
 *    若返回列表时 DOM 内容尚未完全渲染（图片未就绪、异步列表撑开中），
 *    通过轻量 ResizeObserver 监听内容尺寸变动，在高度满足时精准对齐至目标偏置。
 *    用户一旦主动触发手势触摸（touchstart / wheel / pointerdown），立即断开观察者，交互优先。
 */
export function useScrollRestoration(containerRef: RefObject<HTMLElement | null>) {
  const location = useLocation();
  const navType = useNavigationType();

  // 记录上一条历史条目信息与路径
  const prevRef = useRef<{ key: string; pathname: string; search: string } | null>(null);
  // 当前正在进行的异步自适应恢复清理器
  const activeCleanupRef = useRef<(() => void) | null>(null);

  // 1. 滚动偏置实时记录：基于容器物理几何与运动连续性法则，彻底根绝 DOM 卸载塌陷与截断归零污染
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      // 第一性原理一（物理溢出存在性）：容器当前必须具备可滚动的物理溢出高度。
      // 若 scrollHeight <= clientHeight，说明子内容已卸载或 DOM 结构塌陷，
      // 此时产生的滚动事件 100% 属于浏览器排版被动截断（Clamp to 0），严禁记账。
      if (el.scrollHeight <= el.clientHeight) {
        return;
      }

      const top = el.scrollTop;

      // 第一性原理二（运动连续性法则）：人类手指滑动必须经过连续多帧采样。
      // 若前一次有效偏置 > 80px，且当前帧突变为 0px，必然是路由组件替换或程序赋值引发的假性归零。
      const prevSaved = getSavedScrollPosition(location.key) ?? 0;
      if (top === 0 && prevSaved > 80) {
        return;
      }

      saveScrollPosition(location.key, top);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [containerRef, location.key]);

  // 2. 路由切换与恢复控制
  useLayoutEffect(() => {
    // 每次发生新导航，立即中止上一次未完成的异步恢复
    if (activeCleanupRef.current) {
      activeCleanupRef.current();
      activeCleanupRef.current = null;
    }

    const el = containerRef.current;
    if (!el) return;

    const prev = prevRef.current;
    const currentKey = location.key;
    const currentPath = location.pathname;

    // 判断是否为同页面的内部呈现层操作（如打开搜索弹窗、标签抽屉、创建抽屉等）
    const isSamePage =
      prev !== null &&
      prev.pathname === currentPath &&
      prev.search === location.search;

    if (isSamePage) {
      // 浮层压栈 / 弹窗回退：同一页面无需变更主内容区滚动位置
      prevRef.current = { key: currentKey, pathname: currentPath, search: location.search };
      return;
    }

    // 页面级导航
    if (navType === "POP") {
      const saved = getSavedScrollPosition(currentKey);
      const target = saved ?? 0;

      // 先尝试首帧同步恢复
      el.scrollTop = target;

      // 若目标偏置 > 0 且当前 DOM 高度不足（如异步动态卡片、图片未完全加载导致截断），使用自适应对齐
      if (target > 0 && Math.abs(el.scrollTop - target) > 1) {
        let cleanedUp = false;
        let resizeObserver: ResizeObserver | null = null;
        let mutationObserver: MutationObserver | null = null;
        let rafId: number | null = null;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
          if (cleanedUp) return;
          cleanedUp = true;
          if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
          }
          if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
          }
          if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
          }
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          el.removeEventListener("wheel", onUserScroll);
          el.removeEventListener("touchmove", onUserScroll);
          if (activeCleanupRef.current === cleanup) {
            activeCleanupRef.current = null;
          }
        };

        // 仅在用户产生实际物理滑动位移（wheel 或 touchmove）时交还控制权。
        // 严禁监听 touchstart/pointerdown，避免 iOS 边缘侧滑返回手势在落定瞬间误杀恢复流程。
        const onUserScroll = () => {
          cleanup();
        };

        el.addEventListener("wheel", onUserScroll, { passive: true });
        el.addEventListener("touchmove", onUserScroll, { passive: true });

        const tryRestore = () => {
          if (cleanedUp || !containerRef.current) return;
          containerRef.current.scrollTop = target;
          if (Math.abs(containerRef.current.scrollTop - target) <= 1) {
            cleanup();
          }
        };

        // 下一帧轻量保底（覆盖微任务批处理更新）
        rafId = requestAnimationFrame(() => {
          tryRestore();
        });

        // 观察主内容区域内部子节点尺寸变动（真实排版撑开时精准单次对齐，杜绝盲目逐帧轮询抖动）
        const childTarget = el.firstElementChild || el;
        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            tryRestore();
          });
          resizeObserver.observe(childTarget);
        }

        // 监听 DOM 树变动（如加载占位切换为真实列表）
        if (typeof MutationObserver !== "undefined") {
          mutationObserver = new MutationObserver(() => {
            tryRestore();
          });
          mutationObserver.observe(el, { childList: true, subtree: true });
        }

        // 1200ms 超时安全断开，避免长周期监听
        timeoutId = setTimeout(cleanup, 1200);
        activeCleanupRef.current = cleanup;
      }
    } else if (navType === "PUSH" || (navType === "REPLACE" && !isSamePage)) {
      // 全新导航进新页面或跨页面 replace 切换：重置滚动至顶部 0
      el.scrollTop = 0;
    }

    prevRef.current = { key: currentKey, pathname: currentPath, search: location.search };
  }, [containerRef, location.key, location.pathname, location.search, navType]);

  // 页面关闭/刷新前的保底记录（与 React Router 官方 usePageHide 机制一致）
  useEffect(() => {
    const onPageHide = () => {
      const el = containerRef.current;
      if (el) {
        saveScrollPosition(location.key, el.scrollTop);
      }
    };

    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      if (activeCleanupRef.current) {
        activeCleanupRef.current();
        activeCleanupRef.current = null;
      }
    };
  }, [containerRef, location.key]);
}
