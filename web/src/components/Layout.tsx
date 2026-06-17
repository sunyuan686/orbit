import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { TYPE_LABEL } from "../lib/api";
import { useTheme, type Theme } from "../lib/useTheme";

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
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setOpen(false);
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
    <div
      className="flex h-screen transition-colors"
      style={{ background: "var(--color-bg)", color: "var(--color-text-primary)" }}
    >
      {/* 移动端遮罩 */}
      {open && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: "oklch(0 0 0 / 0.35)" }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        ref={sidebarRef}
        style={{
          width: effectiveWidth,
          background: "var(--sidebar-bg)",
          borderRightColor: "var(--sidebar-border)",
        }}
        className={`
          fixed inset-y-0 left-0 z-50 border-r flex flex-col overflow-hidden
          md:static md:translate-x-0 md:shrink-0
          ${open ? "translate-x-0" : "-translate-x-full"}
          ${dragging ? "" : "transition-[width] duration-200 ease-in-out"}
        `}
      >
        {/* 顶部标题 */}
        <div className={`flex items-center justify-between py-5 ${collapsed ? "px-2" : "px-4"}`}>
          {collapsed ? (
            <button
              onClick={toggleCollapsed}
              className="w-full flex justify-center p-1.5 rounded-md transition-colors cursor-pointer"
              style={{ color: "var(--color-text-muted)" }}
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
                <p className="text-xs mt-0.5 truncate" style={{ color: "var(--color-text-muted)" }}>
                  两个人的时间轨道
                </p>
              </div>
              <button
                onClick={toggleCollapsed}
                className="hidden md:flex p-1.5 rounded-md transition-colors cursor-pointer shrink-0"
                style={{ color: "var(--color-text-muted)" }}
                title="折叠侧边栏"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                  <path d="M11 19l-7-7 7-7" /><path d="M18 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="md:hidden p-1.5 rounded-md cursor-pointer"
                style={{ color: "var(--color-text-muted)" }}
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
              {!collapsed && <span style={{ fontSize: "var(--type-secondary)" }}>{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* 底部 */}
        {!collapsed && (
          <div
            className="px-4 py-3 text-xs"
            style={{ borderTop: "1px solid var(--color-border-light)", color: "var(--color-text-muted)" }}
          >
            v0.1.0
          </div>
        )}
      </aside>

      {/* 拖拽手柄 */}
      <div
        onMouseDown={handleMouseDown}
        className="hidden md:block w-px -ml-px cursor-col-resize z-10 shrink-0 transition-colors hover:bg-stone-300 dark:hover:bg-stone-600"
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <header
          className="flex items-center justify-between px-4 md:px-6 py-2.5"
          style={{
            background: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border-light)",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="md:hidden p-1.5 rounded-md cursor-pointer"
              style={{ color: "var(--color-text-secondary)" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <span className="md:hidden text-sm font-medium" style={{ fontFamily: "var(--font-heading)" }}>Orbit</span>
          </div>

          {/* 主题切换 */}
          <button
            onClick={() => {
              const order: Theme[] = ["light", "dark", "system"];
              const next = order[(order.indexOf(theme) + 1) % order.length];
              setTheme(next);
            }}
            className="p-1.5 rounded-md transition-colors cursor-pointer"
            style={{ color: "var(--color-text-muted)" }}
            title={theme === "light" ? "浅色模式" : theme === "dark" ? "深色模式" : "跟随系统"}
          >
            {themeIcons[theme]}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
