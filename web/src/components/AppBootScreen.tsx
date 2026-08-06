/**
 * 启动/加载过渡屏：轨道圆环 + 环绕小圆点动画。
 * 标记与 index.html 内嵌的 app shell 启动屏完全一致（样式由 index.html 提供），
 * 保证冷启动 → React 挂载 → 会话校验各阶段之间无视觉跳变。
 */
export function AppBootScreen() {
  return (
    <div className="orbit-boot" role="status" aria-label="加载中">
      <div className="orbit-boot-orbit" aria-hidden="true">
        <span className="orbit-boot-dot" />
      </div>
      <p className="orbit-boot-name">Orbit</p>
    </div>
  );
}
