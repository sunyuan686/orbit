/**
 * App shell 启动屏的唯一控制点。
 *
 * 启动屏 DOM 由 web/index.html 提供（#orbit-boot，位于 #root 之外），
 * 全程不参与 React 渲染——冷启动期间任何阶段的 DOM 变化都发生在它之下，
 * 因此不存在「启动屏卸载重建 → 动画重播 → 闪烁」。
 *
 * React 渲染出首个有效帧（会话校验完成 / 登录页挂载）后调用
 * dismissBootScreen() 淡出并移除。幂等，可多处调用。
 */

const BOOT_ELEMENT_ID = "orbit-boot";

let dismissed = false;

export function dismissBootScreen(): void {
  if (dismissed) return;

  const el = document.getElementById(BOOT_ELEMENT_ID);
  if (!el) {
    dismissed = true;
    return;
  }

  dismissed = true;

  const remove = () => el.remove();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reducedMotion) {
    remove();
    return;
  }

  el.addEventListener("animationend", remove, { once: true });
  // 兜底：动画被中断（如页面隐藏）时也能移除
  window.setTimeout(remove, 600);
  el.classList.add("orbit-boot--leave");
}
