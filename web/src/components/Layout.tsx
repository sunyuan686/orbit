import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { TYPE_LABEL, authClient } from "../lib/api";
import { setPageTitle } from "../lib/pageTitle";
import { useTheme, type Theme } from "../lib/useTheme";
import { UserAccount } from "./UserAccount";

const navItems = [
  { to: "/diary", label: TYPE_LABEL.diary, icon: "📖" },
  { to: "/timeline", label: TYPE_LABEL.timeline, icon: "💫" },
  { to: "/message", label: TYPE_LABEL.message, icon: "💬" },
  { to: "/letter", label: TYPE_LABEL.letter, icon: "✉️" },
  { to: "/memo", label: TYPE_LABEL.memo, icon: "📌" },
] as const;

const COLLAPSED_KEY = "orbit-sidebar-collapsed";
const WIDTH_KEY = "orbit-sidebar-width";
const DEFAULT_WIDTH = 216;
const MIN_WIDTH = 60;
const MAX_WIDTH = 280;
const COLLAPSE_THRESHOLD = 100;

export function Layout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(WIDTH_KEY);
    return saved ? Number(saved) : DEFAULT_WIDTH;
  });
  const [dragging, setDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { data: session } = authClient.useSession();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const segment = location.pathname.split("/").filter(Boolean)[0];
    if (!segment || segment === "login") return;
    if (segment === "search") {
      setPageTitle("搜索");
      return;
    }
    if (segment === "new" || location.pathname.endsWith("/edit")) return;
    if (/^[a-z]+$/.test(segment) && TYPE_LABEL[segment]) {
      setPageTitle(TYPE_LABEL[segment]);
    }
  }, [location.pathname]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, String(next));
    if (!next) {
      setSidebarWidth(DEFAULT_WIDTH);
      localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH));
    }
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, e.clientX));
      if (newWidth <= COLLAPSE_THRESHOLD) {
        setCollapsed(true);
        localStorage.setItem(COLLAPSED_KEY, "true");
      } else {
        setCollapsed(false);
        localStorage.setItem(COLLAPSED_KEY, "false");
        setSidebarWidth(newWidth);
        localStorage.setItem(WIDTH_KEY, String(newWidth));
      }
    };

    const handleMouseUp = () => setDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  const effectiveWidth = collapsed ? MIN_WIDTH : sidebarWidth;

  const themeIcons: Record<Theme, React.ReactNode> = {
    light: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    dark: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
    system: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  };

  return (
    <div className="orbit-shell flex h-screen transition-colors">
      {open && (
        <div
          className="orbit-overlay-scrim fixed inset-0 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        ref={sidebarRef}
        style={{ width: effectiveWidth }}
        className={`
          orbit-sidebar-panel fixed inset-y-0 left-0 z-50 border-r flex flex-col overflow-hidden
          md:static md:translate-x-0 md:shrink-0
          ${open ? "translate-x-0" : "-translate-x-full"}
          ${dragging ? "" : "transition-[width] duration-200 ease-in-out"}
        `}
      >
        <div className={`flex items-center justify-between py-5 ${collapsed ? "px-2" : "px-4"}`}>
          {collapsed ? (
            <button
              onClick={toggleCollapsed}
              className="orbit-icon-btn w-full flex justify-center p-1.5 cursor-pointer"
              title="展开侧边栏"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M13 5l7 7-7 7" /><path d="M6 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <>
              <div className="min-w-0">
                <h1 className="orbit-sidebar-title tracking-tight">Orbit</h1>
                <p className="orbit-sidebar-tagline mt-0.5 truncate">两个人的时间轨道</p>
              </div>
              <button
                onClick={toggleCollapsed}
                className="orbit-icon-btn hidden md:flex p-1.5 cursor-pointer shrink-0"
                title="折叠侧边栏"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M11 19l-7-7 7-7" /><path d="M18 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="orbit-icon-btn md:hidden p-1.5 cursor-pointer"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* 导航 */}
        <nav className={`flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden ${collapsed ? "px-2" : "px-2"}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center rounded-md transition-colors whitespace-nowrap ${
                  collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"
                } ${isActive ? "orbit-nav-item active" : "orbit-nav-item"}`
              }
              title={collapsed ? item.label : undefined}
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && <span className="orbit-nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* 账号 */}
        <UserAccount collapsed={collapsed} />
      </aside>

      <div
        onMouseDown={handleMouseDown}
        className="orbit-resize-handle hidden md:block w-px -ml-px cursor-col-resize z-10 shrink-0"
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="orbit-header-bar flex items-center justify-between px-4 md:px-6 py-2.5">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              onClick={() => setOpen(true)}
              className="orbit-icon-btn orbit-icon-btn--secondary md:hidden p-1.5 cursor-pointer shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <span className="orbit-heading md:hidden text-sm font-medium shrink-0">Orbit</span>

            <form
              className="hidden sm:flex items-center gap-2 flex-1 max-w-md ml-auto mr-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const q = String(fd.get("q") ?? "").trim();
                navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                className="orbit-search-icon"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3-3" />
              </svg>
              <input
                type="search"
                name="q"
                defaultValue={location.pathname === "/search" ? new URLSearchParams(location.search).get("q") ?? "" : ""}
                key={location.pathname + location.search}
                placeholder="搜索…"
                className="orbit-header-search flex-1 min-w-0 bg-transparent text-sm outline-none"
              />
            </form>
          </div>

          <div className="flex items-center gap-2">
            {session?.user && (
              <span
                className="orbit-sidebar-tagline hidden sm:inline truncate max-w-[140px]"
                title={session.user.email}
              >
                {session.user.name}
              </span>
            )}
            <button
            onClick={() => {
              const order: Theme[] = ["light", "dark", "system"];
              const next = order[(order.indexOf(theme) + 1) % order.length];
              setTheme(next);
            }}
            className="orbit-icon-btn p-1.5 cursor-pointer"
            title={theme === "light" ? "浅色模式" : theme === "dark" ? "深色模式" : "跟随系统"}
          >
            {themeIcons[theme]}
          </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
