import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../lib/api";
import { useToast } from "../hooks/useToast";
import { LogoutIcon, SettingsIcon } from "./OrbitIcons";

interface UserAccountProps {
  collapsed?: boolean;
}

function UserAvatar({ name, title }: { name: string; title?: string }) {
  return (
    <div className="orbit-avatar orbit-sidebar-account-avatar shrink-0" title={title} aria-hidden={!title}>
      {name.slice(0, 1)}
    </div>
  );
}

export function UserAccount({ collapsed = false }: UserAccountProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const user = session?.user;
  const profileTitle = user ? `${user.name}\n${user.email}` : "";

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
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

  const menu = menuOpen ? (
    <div id={menuId} className="orbit-sidebar-account-menu" role="menu" aria-label="账号菜单">
      <div className="orbit-sidebar-account-menu-header">
        <UserAvatar name={user.name} />
        <div className="orbit-sidebar-account-meta min-w-0">
          <p className="orbit-sidebar-account-name truncate">{user.name}</p>
          <p className="orbit-sidebar-tagline truncate" title={user.email}>
            {user.email}
          </p>
        </div>
      </div>
      <div className="orbit-sidebar-account-menu-divider" />
      <Link
        to="/settings"
        role="menuitem"
        className="orbit-sidebar-account-menu-item"
        onClick={() => setMenuOpen(false)}
      >
        <span className="orbit-sidebar-account-menu-item-icon" aria-hidden="true">
          <SettingsIcon size="sm" />
        </span>
        <span>设置</span>
      </Link>
      <div className="orbit-sidebar-account-menu-divider" />
      <button
        type="button"
        role="menuitem"
        className="orbit-sidebar-account-menu-item"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        <span className="orbit-sidebar-account-menu-item-icon" aria-hidden="true">
          <LogoutIcon size="sm" />
        </span>
        <span>{signingOut ? "退出中…" : "退出登录"}</span>
      </button>
    </div>
  ) : null;

  if (collapsed) {
    return (
      <div className="orbit-sidebar-footer orbit-sidebar-footer--collapsed" ref={rootRef}>
        <button
          type="button"
          className={`orbit-sidebar-account-trigger orbit-sidebar-account-trigger--collapsed${menuOpen ? " is-open" : ""}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-controls={menuOpen ? menuId : undefined}
          title={profileTitle}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <UserAvatar name={user.name} />
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className="orbit-sidebar-footer px-2 py-2" ref={rootRef}>
      <button
        type="button"
        className={`orbit-sidebar-account-trigger${menuOpen ? " is-open" : ""}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <UserAvatar name={user.name} />
        <div className="orbit-sidebar-account-meta min-w-0 text-left">
          <p className="orbit-sidebar-account-name truncate">{user.name}</p>
          <p className="orbit-sidebar-tagline truncate" title={user.email}>
            {user.email}
          </p>
        </div>
      </button>
      {menu}
    </div>
  );
}
