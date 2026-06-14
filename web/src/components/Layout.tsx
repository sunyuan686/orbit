import { useState, useEffect, useRef, useCallback } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { TYPE_LABEL } from "../lib/api";
import { useTheme, type Theme } from "../lib/useTheme";

type NavLeaf = { to: string; label: string; icon: string };
type NavGroup = { label: string; icon: string; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;

const navItems: NavItem[] = [
  { to: "/diary", label: TYPE_LABEL.diary, icon: "📖" },
  {
    label: "传情",
    icon: "💌",
    children: [
      { to: "/messages", label: TYPE_LABEL.messages, icon: "💬" },
      { to: "/letters", label: TYPE_LABEL.letters, icon: "✉️" },
    ],
  },
  { to: "/memo", label: TYPE_LABEL.memo, icon: "📌" },
];

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item;
}

const COLLAPSED_KEY = "orbit-sidebar-collapsed";
const WIDTH_KEY = "orbit-sidebar-width";
const DEFAULT_WIDTH = 224; // w-56 = 14rem = 224px
const MIN_WIDTH = 64;
const MAX_WIDTH = 280;
const COLLAPSE_THRESHOLD = 100;

export function Layout() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(WIDTH_KEY);
    return saved ? Number(saved) : DEFAULT_WIDTH;
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  // 路由变化时关闭移动端侧边栏
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // 当前路由匹配某个分组的子项时，自动展开该分组
  useEffect(() => {
    for (const item of navItems) {
      if (isGroup(item) && item.children.some((c) => location.pathname.startsWith(c.to))) {
        setExpandedGroups((prev) => {
          if (prev.has(item.label)) return prev;
          return new Set(prev).add(item.label);
        });
      }
    }
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSED_KEY, String(next));
    if (!next) {
      setSidebarWidth(DEFAULT_WIDTH);
      localStorage.setItem(WIDTH_KEY, String(DEFAULT_WIDTH));
    }
  };

  // 拖拽逻辑
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

    const handleMouseUp = () => {
      setDragging(false);
    };

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

  return (
    <div className="flex h-screen bg-stone-50 dark:bg-stone-900 text-stone-800 dark:text-stone-200 transition-colors">
      {/* 移动端遮罩 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 侧边栏 */}
      <aside
        ref={sidebarRef}
        style={{ width: effectiveWidth }}
        className={`
          fixed inset-y-0 left-0 z-50 border-r border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 flex flex-col overflow-hidden
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
              className="w-full flex justify-center p-1.5 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 rounded-md hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
              title="展开侧边栏"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M13 5l7 7-7 7" />
                <path d="M6 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-wide">Orbit</h1>
                <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 truncate">两个人的时间轨道</p>
              </div>
              <button
                onClick={toggleCollapsed}
                className="hidden md:flex p-1.5 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 rounded-md hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors shrink-0"
                title="折叠侧边栏"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 19l-7-7 7-7" />
                  <path d="M18 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="md:hidden p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* 导航 */}
        <nav className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden ${collapsed ? "px-2" : "px-3"}`}>
          {navItems.map((item) =>
            isGroup(item) ? (
              <div key={item.label}>
                <button
                  onClick={() => !collapsed && toggleGroup(item.label)}
                  className={`w-full flex items-center rounded-lg text-sm transition-colors whitespace-nowrap ${
                    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                  } ${
                    item.children.some((c) => location.pathname.startsWith(c.to))
                      ? "text-stone-900 dark:text-stone-100 font-medium"
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700/50 hover:text-stone-700 dark:hover:text-stone-300"
                  }`}
                  title={collapsed ? item.label : undefined}
                >
                  <span>{item.icon}</span>
                  {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                  {!collapsed && (
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      className={`shrink-0 transition-transform duration-200 ${expandedGroups.has(item.label) ? "rotate-90" : ""}`}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  )}
                </button>
                {!collapsed && expandedGroups.has(item.label) && (
                  <div className="space-y-0.5 mt-0.5">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) =>
                          `flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap ${
                            isActive
                              ? "bg-stone-100 dark:bg-stone-700 text-stone-900 dark:text-stone-100 font-medium"
                              : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700/50 hover:text-stone-700 dark:hover:text-stone-300"
                          }`
                        }
                      >
                        <span>{child.icon}</span>
                        <span>{child.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center rounded-lg text-sm transition-colors whitespace-nowrap ${
                    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5"
                  } ${
                    isActive
                      ? "bg-stone-100 dark:bg-stone-700 text-stone-900 dark:text-stone-100 font-medium"
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-700/50 hover:text-stone-700 dark:hover:text-stone-300"
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <span>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            )
          )}
        </nav>

        {/* 底部版本号 */}
        {!collapsed && (
          <div className="border-t border-stone-100 dark:border-stone-700 px-5 py-3 text-xs text-stone-300 dark:text-stone-600">
            v0.0.1
          </div>
        )}
      </aside>

      {/* 拖拽手柄（仅桌面端） */}
      <div
        onMouseDown={handleMouseDown}
        className="hidden md:block w-1 -ml-0.5 cursor-col-resize hover:bg-stone-300 dark:hover:bg-stone-600 active:bg-stone-400 dark:active:bg-stone-500 transition-colors z-10 shrink-0"
      />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶栏 */}
        <header className="flex items-center justify-between px-4 md:px-8 py-3 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="md:hidden p-1.5 text-stone-600 dark:text-stone-300 hover:text-stone-800 dark:hover:text-stone-100"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <span className="md:hidden text-sm font-semibold">Orbit</span>
          </div>

          {/* 主题切换 */}
          <button
            onClick={() => {
              const order: Theme[] = ["light", "dark", "system"];
              const next = order[(order.indexOf(theme) + 1) % order.length];
              setTheme(next);
            }}
            className="p-2 text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700 rounded-lg transition-colors"
            title={theme === "light" ? "浅色模式" : theme === "dark" ? "深色模式" : "跟随系统"}
          >
            {theme === "light" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
            {theme === "dark" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
            {theme === "system" && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            )}
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
