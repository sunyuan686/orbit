import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/api";
import { useToast } from "../lib/useToast";
import { useState } from "react";
import { LogoutIcon } from "./OrbitIcons";

interface UserAccountProps {
  collapsed?: boolean;
}

function UserAvatar({ name, title }: { name: string; title: string }) {
  return (
    <div className="orbit-avatar orbit-sidebar-account-avatar shrink-0" title={title}>
      {name.slice(0, 1)}
    </div>
  );
}

export function UserAccount({ collapsed = false }: UserAccountProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  const user = session?.user;
  const profileTitle = user ? `${user.name}\n${user.email}` : "";

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut({ fetchOptions: { credentials: "include" } });
      toast.success("已退出登录");
      navigate("/login", { replace: true });
    } catch {
      toast.error("退出失败，请稍后重试");
    } finally {
      setSigningOut(false);
    }
  };

  if (isPending) {
    return (
      <div
        className={`orbit-sidebar-footer orbit-muted ${collapsed ? "orbit-sidebar-footer--collapsed" : "px-4 py-3 text-xs"}`}
      >
        {collapsed ? "…" : "加载账号…"}
      </div>
    );
  }

  if (!user) return null;

  if (collapsed) {
    return (
      <div className="orbit-sidebar-footer orbit-sidebar-footer--collapsed">
        <UserAvatar name={user.name} title={profileTitle} />
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="orbit-icon-btn p-2 cursor-pointer w-full flex justify-center"
          title="退出登录"
          aria-label="退出登录"
        >
          <LogoutIcon />
        </button>
      </div>
    );
  }

  return (
    <div className="orbit-sidebar-footer px-3 py-3">
      <div className="orbit-sidebar-account-identity">
        <UserAvatar name={user.name} title={profileTitle} />
        <div className="orbit-sidebar-account-meta min-w-0">
          <p className="orbit-sidebar-account-name truncate">{user.name}</p>
          <p className="orbit-sidebar-tagline truncate" title={user.email}>
            {user.email}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="orbit-btn orbit-sidebar-logout-btn w-full mt-2.5"
      >
        {signingOut ? "退出中…" : "退出登录"}
      </button>
    </div>
  );
}
