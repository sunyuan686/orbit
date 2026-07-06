import { useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { TYPE_LABEL, formatSpaceTagline } from "../lib/api";
import { setPageTitle } from "../lib/pageTitle";
import { useTheme, type Theme } from "../lib/useTheme";
import { SpaceProvider, useSpace } from "../lib/spaceContext";
import { AppSettingsProvider } from "../lib/appSettingsContext";
import { UserAccount } from "./UserAccount";
import { SettingsIcon, SunIcon, MoonIcon, MonitorIcon, SearchIcon, MenuIcon, CloseIcon, SidebarExpandIcon, SidebarCollapseIcon, GalleryIcon, ActivityIcon, HomeIcon, NAV_CONTENT_ICONS, type NavContentType } from "./OrbitIcons";
import { NotificationBell } from "./NotificationBell";
import { AiChatFab } from "./AiChatFab";
import { AiChatPanel, type AiChatContext } from "./AiChatPanel";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

const navItems: { to: string; label: string; type: NavContentType }[] = [
  { to: "/diary", label: TYPE_LABEL.diary, type: "diary" },
  { to: "/timeline", label: TYPE_LABEL.timeline, type: "timeline" },
  { to: "/message", label: TYPE_LABEL.message, type: "message" },
  { to: "/letter", label: TYPE_LABEL.letter, type: "letter" },
  { to: "/memo", label: TYPE_LABEL.memo, type: "memo" },
];

const galleryNav = { to: "/gallery", label: "相册" };
const activityNav = { to: "/activity", label: "记录活动" };

const COLLAPSED_KEY = "orbit-sidebar-collapsed";
const WIDTH_KEY = "orbit-sidebar-width";
const DEFAULT_WIDTH = 216;
const MIN_WIDTH = 60;
const MAX_WIDTH = 280;
const COLLAPSE_THRESHOLD = 100;

export function Layout() {
  return (
    <SpaceProvider>
      <AppSettingsProvider>
        <LayoutShell />
      </AppSettingsProvider>
    </SpaceProvider>
  );
}

function LayoutShell() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(WIDTH_KEY);
    return saved ? Number(saved) : DEFAULT_WIDTH;
  });
  const [dragging, setDragging] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { profile, loading: spaceLoading } = useSpace();

  const articleMatch = location.pathname.match(
    /^\/(diary|timeline|message|letter)\/([^/]+)$/
  );
  const aiContext: AiChatContext = articleMatch
    ? { mode: "article", articleId: articleMatch[2] }
    : { mode: "global" };

  const [prevPathname, setPrevPathname] = useState(location.pathname);
  if (location.pathname !== prevPathname) {
    setPrevPathname(location.pathname);
    setOpen(false);
  }

  useEffect(() => {
    const segment = location.pathname.split("/").filter(Boolean)[0];
    if (!segment) {
      setPageTitle("首页");
      return;
    }
    if (segment === "login") return;
    if (segment === "search") {
      setPageTitle("搜索");
      return;
    }
    if (segment === "gallery") {
      setPageTitle("相册");
      return;
    }
    if (segment === "activity") {
      setPageTitle("记录活动");
      return;
    }
    if (segment === "settings") {
      setPageTitle("设置");
      return;
    }
    if (segment === "new" || location.pathname.endsWith("/edit")) return;
    if (/^[a-z]+$/.test(segment) && TYPE_LABEL[segment]) {
      setPageTitle(TYPE_LABEL[segment]);
    }
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "j") return;
      if (event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (
        target.closest('input, textarea, [contenteditable="true"]') &&
        !target.closest(".orbit-ai-panel")
      ) {
        return;
      }
      event.preventDefault();
      setAiOpen((current) => !current);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    light: <SunIcon />,
    dark: <MoonIcon />,
    system: <MonitorIcon />,
  };

  return (
    <div className="orbit-shell flex h-screen transition-colors">
      <div
        className={`orbit-overlay-scrim fixed inset-0 z-40 md:hidden${
          open ? " orbit-overlay-scrim--visible" : ""
        }`}
        onClick={() => setOpen(false)}
        aria-hidden={!open}
      />

      <aside
        ref={sidebarRef}
        style={{ width: effectiveWidth }}
        className={`
          orbit-sidebar-panel fixed inset-y-0 left-0 z-50 border-r flex flex-col overflow-hidden
          md:static md:translate-x-0 md:shrink-0
          ${open ? "translate-x-0" : "-translate-x-full"}
          ${dragging ? "orbit-sidebar-panel--dragging" : ""}
        `}
      >
        <div className={`flex items-center justify-between py-5 ${collapsed ? "px-2" : "px-4"}`}>
          {collapsed ? (
            <button
              onClick={toggleCollapsed}
              className="orbit-icon-btn w-full flex justify-center p-1.5 cursor-pointer"
              title="展开侧边栏"
            >
              <SidebarExpandIcon size="md" />
            </button>
          ) : (
            <>
              <Link
                to="/"
                className="orbit-sidebar-brand-link min-w-0 flex-1"
                title="首页"
              >
                <h1 className="orbit-sidebar-title tracking-tight">Orbit</h1>
                <p className="orbit-sidebar-tagline truncate mt-0.5">
                  {spaceLoading ? "加载中…" : formatSpaceTagline(profile)}
                </p>
              </Link>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="orbit-icon-btn hidden md:inline-flex p-1.5 cursor-pointer shrink-0"
                title="折叠侧边栏"
                aria-label="折叠侧边栏"
              >
                <SidebarCollapseIcon />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="orbit-icon-btn inline-flex md:hidden p-1.5 cursor-pointer shrink-0"
                title="关闭菜单"
                aria-label="关闭菜单"
              >
                <CloseIcon size="md" />
              </button>
            </>
          )}
        </div>

        {/* 导航 */}
        <nav className={`flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden ${collapsed ? "px-2" : "px-2"}`}>
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center rounded-md transition-colors whitespace-nowrap ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"
              } ${isActive ? "orbit-nav-item active" : "orbit-nav-item"}`
            }
            title={collapsed ? "首页" : undefined}
          >
            <HomeIcon size="nav" className="orbit-nav-icon" />
            {!collapsed && <span className="orbit-nav-label">首页</span>}
          </NavLink>
          {navItems.map((item) => {
            const NavIcon = NAV_CONTENT_ICONS[item.type];
            return (
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
              <NavIcon size="nav" className="orbit-nav-icon" />
              {!collapsed && <span className="orbit-nav-label">{item.label}</span>}
            </NavLink>
            );
          })}
          <NavLink
            to={galleryNav.to}
            className={({ isActive }) =>
              `flex items-center rounded-md transition-colors whitespace-nowrap ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"
              } ${isActive ? "orbit-nav-item active" : "orbit-nav-item"}`
            }
            title={collapsed ? galleryNav.label : undefined}
          >
            <GalleryIcon size="nav" className="orbit-nav-icon" />
            {!collapsed && <span className="orbit-nav-label">{galleryNav.label}</span>}
          </NavLink>
          <NavLink
            to={activityNav.to}
            className={({ isActive }) =>
              `flex items-center rounded-md transition-colors whitespace-nowrap ${
                collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"
              } ${isActive ? "orbit-nav-item active" : "orbit-nav-item"}`
            }
            title={collapsed ? activityNav.label : undefined}
          >
            <ActivityIcon size="nav" className="orbit-nav-icon" />
            {!collapsed && <span className="orbit-nav-label">{activityNav.label}</span>}
          </NavLink>
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
              type="button"
              onClick={() => setOpen(true)}
              className="orbit-icon-btn orbit-icon-btn--secondary inline-flex md:hidden p-1.5 cursor-pointer shrink-0"
              aria-label="打开菜单"
            >
              <MenuIcon size="md" />
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
              <SearchIcon className="orbit-search-icon" />
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

          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell />
            <Link
              to="/settings"
              className="orbit-icon-btn inline-flex p-1.5 cursor-pointer"
              title="设置"
              aria-label="设置"
            >
              <SettingsIcon />
            </Link>
            <button
            onClick={() => {
              const order: Theme[] = ["light", "dark", "system"];
              const next = order[(order.indexOf(theme) + 1) % order.length];
              setTheme(next);
            }}
            className="orbit-icon-btn inline-flex p-1.5 cursor-pointer"
            title={theme === "light" ? "浅色模式" : theme === "dark" ? "深色模式" : "跟随系统"}
          >
            {themeIcons[theme]}
          </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8">
          <RouteErrorBoundary>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
      <AiChatFab open={aiOpen} onClick={() => setAiOpen(true)} />
      <AiChatPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        context={aiContext}
      />
    </div>
  );
}
