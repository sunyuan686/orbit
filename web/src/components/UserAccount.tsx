import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../lib/api";
import { getDefaultAvatar } from "../lib/presetAvatars";
import { useToast } from "../hooks/useToast";
import { usePwaUpdate } from "../hooks/usePwaUpdate";
import { LogoutIcon, SettingsIcon } from "./OrbitIcons";

interface UserAccountProps {
  collapsed?: boolean;
}

function UserAvatar({
  name,
  image,
  userId,
  title,
}: {
  name: string;
  image?: string | null;
  userId?: string | null;
  title?: string;
}) {
  const avatarSrc = image || getDefaultAvatar(userId);
  return (
    <img
      src={avatarSrc}
      alt={name}
      className="orbit-sidebar-account-avatar shrink-0 object-cover bg-[var(--color-surface-raised)] border border-[var(--color-border-light)]"
      title={title}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(userId);
      }}
    />
  );
}

export function UserAccount({ collapsed = false }: UserAccountProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { needRefresh } = usePwaUpdate();
  const { data: session, isPending } = authClient.useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const user = session?.user;
  const profileTitle = user ? `${user.name}\n${user.email}` : "";

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
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
        <UserAvatar name={user.name} image={user.image} userId={user.id} />
        <div className="orbit-sidebar-account-meta min-w-0">
          <p className="orbit-sidebar-account-name truncate">{user.name}</p>
          <p className="orbit-sidebar-tagline truncate" title={user.email}>
            {user.email}
          </p>
        </div>
      </div>
      <div className="orbit-sidebar-account-menu-divider" />
      <Link
        to="/settings?tab=about"
        role="menuitem"
        className="orbit-sidebar-account-menu-item"
        onClick={() => setMenuOpen(false)}
      >
        <span className="orbit-sidebar-account-menu-item-icon" aria-hidden="true">
          <SettingsIcon size="sm" />
        </span>
        <span className="flex items-center justify-between flex-1 min-w-0">
          <span>设置</span>
          {needRefresh ? (
            <span
              className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0 ml-1.5"
              title="新版本可用"
              aria-label="新版本可用"
            />
          ) : null}
        </span>
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
          className={`orbit-sidebar-account-trigger orbit-sidebar-account-trigger--collapsed relative${menuOpen ? " is-open" : ""}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-controls={menuOpen ? menuId : undefined}
          title={profileTitle}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <UserAvatar name={user.name} image={user.image} userId={user.id} />
          {needRefresh ? (
            <span
              className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-surface)] pointer-events-none"
              aria-hidden="true"
            />
          ) : null}
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className="orbit-sidebar-footer px-2 py-2" ref={rootRef}>
      <button
        type="button"
        className={`orbit-sidebar-account-trigger relative${menuOpen ? " is-open" : ""}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <UserAvatar name={user.name} image={user.image} userId={user.id} />
        <div className="orbit-sidebar-account-meta min-w-0 text-left flex-1">
          <p className="orbit-sidebar-account-name truncate">{user.name}</p>
          <p className="orbit-sidebar-tagline truncate" title={user.email}>
            {user.email}
          </p>
        </div>
        {needRefresh ? (
          <span
            className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0 self-center"
            title="新版本可用"
            aria-label="新版本可用"
          />
        ) : null}
      </button>
      {menu}
    </div>
  );
}
