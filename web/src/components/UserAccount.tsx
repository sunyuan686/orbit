import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/api";
import { useToast } from "../lib/useToast";
import { useState } from "react";

interface UserAccountProps {
  collapsed?: boolean;
}

export function UserAccount({ collapsed = false }: UserAccountProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);

  const user = session?.user;

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
        className={`${collapsed ? "px-2 py-3 flex justify-center" : "px-4 py-3 text-xs"}`}
        style={{ color: "var(--color-text-muted)", borderTop: "1px solid var(--color-border-light)" }}
      >
        {collapsed ? "…" : "加载账号…"}
      </div>
    );
  }

  if (!user) return null;

  if (collapsed) {
    return (
      <div
        className="px-2 py-3 flex flex-col items-center gap-2"
        style={{ borderTop: "1px solid var(--color-border-light)" }}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium"
          style={{ background: "var(--color-border-light)", color: "var(--color-text-secondary)" }}
          title={`${user.name}\n${user.email}`}
        >
          {user.name.slice(0, 1)}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="p-1.5 rounded-md cursor-pointer"
          style={{ color: "var(--color-text-muted)" }}
          title="退出登录"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      className="px-4 py-3 space-y-3"
      style={{ borderTop: "1px solid var(--color-border-light)" }}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{user.name}</p>
        <p className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>
          {user.email}
        </p>
      </div>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={signingOut}
        className="orbit-btn w-full"
      >
        {signingOut ? "退出中…" : "退出登录"}
      </button>
    </div>
  );
}
