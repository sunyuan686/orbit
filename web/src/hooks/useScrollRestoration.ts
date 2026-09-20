import { useLayoutEffect, useEffect, type RefObject } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { getSavedScrollPosition, saveScrollPosition } from "../lib/scrollPositions";

/**
 * 第一性原理滚动容器恢复机制。
 *
 * 针对 App-Shell 架构（html/body overflow: hidden，内部 `<main>` 为滚动容器）：
 * 1. 在用户滚动时，通过 passive 监听实时记录当前历史条目的滚动偏置（无阻塞，纳秒级 Map 写入）；
 * 2. 路由切换时，在浏览器首次绘制真实像素前（useLayoutEffect）：
 *    - POP（返回/前进）：同步恢复该历史条目先前记录的 scrollTop，实现从原生手势快照到真实 DOM 的无缝衔接；
 *    - PUSH（全新导航）：将容器重置为顶部 0；
 * 3. 异步内容兜底：若内容由子组件异步撑开，当前帧高度暂时不足，则在下一帧 requestAnimationFrame 再次对齐。
 */
export function useScrollRestoration(containerRef: RefObject<HTMLElement | null>) {
  const location = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      saveScrollPosition(location.key, el.scrollTop);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
    };
  }, [containerRef, location.key]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (navType === "POP") {
      const saved = getSavedScrollPosition(location.key);
      if (saved !== undefined) {
        el.scrollTop = saved;
        // 兜底：若目标容器内容尚未由子元素同步撑开（例如列表组件有微秒级异步就绪时），在下一帧再次补正
        if (el.scrollTop !== saved && el.scrollHeight <= el.clientHeight) {
          requestAnimationFrame(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = saved;
            }
          });
        }
      }
    } else if (navType === "PUSH") {
      el.scrollTop = 0;
    }
  }, [containerRef, location.key, navType]);
}
