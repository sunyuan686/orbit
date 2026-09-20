import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { historyIndex, readLayers, sameUrl, withoutLayer } from "../lib/layers";

/**
 * 导航引导：在首次绘制前完成两件只有启动期才该做的事。
 *
 * 1. **剥离瞬时呈现层**。会话历史条目会跨刷新保留，`location.state.layers` 因此在刷新后
 *    仍然成立；若不清理，刷新前打开着的搜索框/抽屉会在刷新后自动弹回。按 plans/055
 *    「决策记录」决策 2，瞬时呈现层不跨刷新恢复；由 URL 承载的呈现层不使用 state，
 *    天然不受影响。
 *
 * 2. **补根锚点**。冷启动直达深链（如从外部链接打开 `/entry/xxx`）时，栈里只有这一条
 *    条目，返回手势会直接离开 App。此时先 `replace` 到首页、再 `push` 目标页，把栈补成
 *    `[/, target]`，返回手势即回到首页。两条导航在同一批次内完成，中间态不绘制。
 *    刷新不触发此分支——那时 `idx > 0`，历史条目仍是本 App 创建的，返回本就安全。
 *
 * 只执行一次，且全部走 router 的导航 API，不手写 `window.history.*`。
 */
export function NavigationBootstrap() {
  const location = useLocation();
  const navigate = useNavigate();
  const consumed = useRef(false);

  useLayoutEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    const target = sameUrl(location);
    const hasLayers = readLayers(location.state).length > 0;
    // 补锚点时目标页是新压入的条目，本就不该带层；其余情况下按决策 2 剥离。
    const state = hasLayers ? withoutLayer(location.state) : location.state;

    if (location.pathname !== "/" && historyIndex(window.history.state) === 0) {
      void (async () => {
        await navigate("/", { replace: true });
        navigate(target, { state });
      })();
      return;
    }

    if (hasLayers) {
      navigate(target, { replace: true, state });
    }
  }, [location, navigate]);

  return null;
}
