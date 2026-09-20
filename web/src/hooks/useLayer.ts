import { useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { readLayers, replaceTopLayer, sameUrl, withLayer } from "../lib/layers";

export interface LayerControls {
  /** 本层是否打开：完全由 location 派生，组件不自持 open 状态 */
  isOpen: boolean;
  /** 打开本层：压入一条同 URL 历史条目 */
  open: () => void;
  /** 关闭本层：唯一关闭路径（按钮 / 遮罩 / Esc / 返回手势殊途同归） */
  close: () => void;
  /**
   * 把本层就地换成另一层（层级深度不变）。用于"离开本浮层、直接进入另一个浮层"，
   * 只有本层位于栈顶时才生效。不要用 close() + 另一层的 open() 凑，见 replaceTopLayer 注释。
   */
  replaceWith: (nextKey: string) => void;
}

/**
 * 呈现层开关。返回手势之所以能关闭浮层，是因为浮层本身就是一条历史条目。
 *
 * `isOpen` 判定的是"本层是否在栈上"而非"本层是否在最上层"：外层浮层在内层
 * 打开期间必须继续渲染，否则会出现"父层被卸载、只剩子层悬空"。
 *
 * `open` / `close` 的标识在组件生命周期内恒定，且始终读取最新一次渲染的 location。
 * 这有两层意义：
 *   1. 可以安全地放进依赖数组，也可以被 `useCallback(fn, [])` 捕获而不会读到过期导航状态；
 *   2. 即使在 `await` 之后调用，也不会把基于过期层栈的条目压进历史。
 *
 * 用法：`const { isOpen, open, close } = useLayer("search")`，
 * 再把 isOpen / close 传给既有浮层组件的 isOpen / onClose。
 */
export function useLayer(key: string): LayerControls {
  const location = useLocation();
  const navigate = useNavigate();

  // 渲染期同步：引用对象恒定，事件回调与异步续段都读到最新一次渲染的 location。
  const locationRef = useRef(location);
  locationRef.current = location;

  const open = useCallback(() => {
    const current = locationRef.current;
    // 本层已在栈上时不再压栈，否则连点会堆出多条同层条目，需要连按多次返回才能退出。
    if (readLayers(current.state).some((layer) => layer.key === key)) return;
    navigate(sameUrl(current), { state: withLayer(current.state, key) });
  }, [key, navigate]);

  const close = useCallback(() => {
    // 仅当本层确实位于栈顶时才回退，避免误退页面，也避免父层越权关闭子层。
    const stack = readLayers(locationRef.current.state);
    if (stack.length === 0 || stack[stack.length - 1].key !== key) return;
    navigate(-1);
  }, [key, navigate]);

  const replaceWith = useCallback(
    (nextKey: string) => {
      const current = locationRef.current;
      const stack = readLayers(current.state);
      if (stack.length === 0 || stack[stack.length - 1].key !== key) return;
      navigate(sameUrl(current), {
        replace: true,
        state: replaceTopLayer(current.state, nextKey),
      });
    },
    [key, navigate],
  );

  const isOpen = readLayers(location.state).some((layer) => layer.key === key);

  return { isOpen, open, close, replaceWith };
}
