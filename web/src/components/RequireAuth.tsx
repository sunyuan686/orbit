import { useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authClient } from "../lib/api";
import { dismissBootScreen } from "../lib/bootScreen";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation();

  // 会话校验期间返回 null：App shell 启动屏（index.html #orbit-boot）仍覆盖在页面上，
  // 由它保证视觉连续，避免渲染替代组件导致的卸载重建闪烁。
  // 校验完成（无论成功与否）后淡出启动屏——首个有效帧已提交或即将跳转登录页。
  useEffect(() => {
    if (!isPending) {
      dismissBootScreen();
    }
  }, [isPending]);

  if (isPending) {
    return null;
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
