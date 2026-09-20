import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTheme, type Theme } from "../../hooks/useTheme";
import { useAiArticleMeta } from "../../contexts/aiArticleContext";
import { UserAccount } from "../UserAccount";
import {
  SunIcon,
  MoonIcon,
  MonitorIcon,
  SearchIcon,
  PanelLeftIcon,
  MomentIcon,
  AlbumIcon,
  LetterIcon,
  UsIcon,
  type NavContentType,
} from "../OrbitIcons";
import { NotificationBell } from "../NotificationBell";
import { SearchModal } from "../SearchModal";
import { AiChatFab } from "../AiChatFab";
import { AiChatPanel, type AiChatContext } from "../AiChatPanel";
import { RouteErrorBoundary } from "../RouteErrorBoundary";
import { PwaInstallGuideModal } from "../PwaInstallGuideModal";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { useLayer } from "../../hooks/useLayer";
import { useScrollRestoration } from "../../hooks/useScrollRestoration";
import { setPageTitle } from "../../lib/pageTitle";

const COLLAPSED_KEY = "orbit-sidebar-collapsed";
const WIDTH_KEY = "orbit-sidebar-width";
const DEFAULT_WIDTH = 216;
const MIN_WIDTH = 60;
const MAX_WIDTH = 280;
const COLLAPSE_THRESHOLD = 100;

export function DesktopShell() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === "true");
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(WIDTH_KEY);
    return saved ? Number(saved) : DEFAULT_WIDTH;
  });
  const [dragging, setDragging] = useState(false);
  const { isOpen: searchOpen, open: openSearch, close: closeSearch } = useLayer("search");
  const { isOpen: aiOpen, open: openAi, close: closeAi } = useLayer("ai");
  const [aiMounted, setAiMounted] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useScrollRestoration(mainRef);
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { meta: aiArticleMeta } = useAiArticleMeta();
  const { guideOpen, closeGuide } = usePwaInstall();

  const segments = location.pathname.split("/").filter(Boolean);
  const isEntryDetailRoute =
    segments.length === 2 &&
    (segments[0] === "moment" || segments[0] === "letter") &&
    segments[1] !== "new";
  const isEditorRoute =
    location.pathname.endsWith("/edit") ||
    (segments.length >= 2 && segments[1] === "new");
  const isImmersiveRoute = isEditorRoute || isEntryDetailRoute;

  const aiContext: AiChatContext = isEntryDetailRoute
    ? { mode: "article", articleId: segments[1] }
    : { mode: "global" };
  const aiArticleTitle =
    aiContext.mode === "article" &&
    aiArticleMeta &&
    aiArticleMeta.articleId === aiContext.articleId
      ? aiArticleMeta.title
      : undefined;
  const aiArticleType = isEntryDetailRoute ? (segments[0] as NavContentType) : undefined;

  const currentTitle = useMemo(() => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const segment = pathSegments[0];
    if (!segment || segment === "moment") return "动态";
    if (segment === "albums" || segment === "gallery") return "相册";
    if (segment === "letter") return "信箱";
    if (segment === "us" || segment === "space") return "我们";
    if (segment === "memories") return "记忆星图";
    if (segment === "settings") return "设置";
    if (segment === "search") return "搜索";
    return "";
  }, [location.pathname]);

  useEffect(() => {
    setPageTitle(currentTitle || "首页");
  }, [currentTitle]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.shiftKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "j") {
        const target = event.target as HTMLElement;
        if (
          target.closest('input, textarea, [contenteditable="true"]') &&
          !target.closest(".orbit-ai-panel")
        ) {
          return;
        }
        event.preventDefault();
        if (aiOpen) {
          closeAi();
        } else {
          setAiMounted(true);
          openAi();
        }
      } else if (key === "k") {
        const target = event.target as HTMLElement;
        if (
          target.closest('input, textarea, [contenteditable="true"]') &&
          !target.closest(".orbit-search-modal-dialog")
        ) {
          return;
        }
        event.preventDefault();
        if (searchOpen) closeSearch();
        else openSearch();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, searchOpen, openSearch, closeSearch, aiOpen, openAi, closeAi]);

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
      if (e.clientX < COLLAPSE_THRESHOLD) {
        setCollapsed(true);
        localStorage.setItem(COLLAPSED_KEY, "true");
        return;
      }
      setCollapsed(false);
      localStorage.setItem(COLLAPSED_KEY, "false");
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem(WIDTH_KEY, String(newWidth));
    };

    const handleMouseUp = () => setDragging(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  const cycleTheme = () => {
    const next: Record<Theme, Theme> = { light: "dark", dark: "system", system: "light" };
    setTheme(next[theme]);
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    [
      "flex items-center gap-2.5 rounded-lg text-sm transition-colors duration-150 select-none",
      collapsed ? "justify-center p-2.5" : "px-3 py-2",
      isActive
        ? "bg-[var(--color-surface-raised)] text-[var(--color-primary)] font-medium"
        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]/60",
    ].join(" ");

  return (
    <div className="orbit-shell flex flex-col">
      <div className="flex flex-1 relative min-h-0 h-full overflow-hidden">
        {/* 桌面端侧边栏 */}
        <aside
          ref={sidebarRef}
          aria-label="主要导航"
          style={{ width: collapsed ? "60px" : `${sidebarWidth}px` }}
          className={[
            "hidden md:flex flex-col flex-shrink-0 relative h-full",
            "bg-[var(--color-surface)] border-r border-[var(--color-border-light)]",
            dragging ? "select-none" : "transition-[width] duration-200 ease-out",
          ].join(" ")}
        >
          {/* 拖拽调整手柄 */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="拖拽调整侧边栏宽度"
            tabIndex={0}
            onMouseDown={handleMouseDown}
            className={[
              "absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 transition-colors",
              dragging ? "bg-[var(--color-accent)]" : "hover:bg-[var(--color-accent)]/50",
            ].join(" ")}
          />

          {/* 品牌与侧边栏折叠控制 */}
          <div
            className={`h-14 flex items-center border-b border-[var(--color-border-light)] select-none group ${
              collapsed ? "justify-center px-2" : "justify-between px-4"
            }`}
          >
            {collapsed ? (
              <button
                type="button"
                onClick={toggleCollapsed}
                aria-label="展开侧边栏"
                title="展开侧边栏"
                className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer shrink-0"
              >
                <span className="font-heading font-semibold text-lg text-[var(--color-primary)] tracking-wide group-hover:opacity-0 transition-opacity duration-150">
                  O
                </span>
                <span className="absolute inset-0 flex items-center justify-center text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  <PanelLeftIcon size="sm" />
                </span>
              </button>
            ) : (
              <>
                <Link
                  to="/"
                  className="font-heading font-semibold text-lg text-[var(--color-primary)] tracking-wide flex items-center gap-1.5 overflow-hidden"
                  title="Orbit"
                >
                  <span>Orbit</span>
                </Link>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label="收起侧边栏"
                  title="收起侧边栏"
                  className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 cursor-pointer flex items-center justify-center shrink-0"
                >
                  <PanelLeftIcon size="sm" />
                </button>
              </>
            )}
          </div>

          {/* 四大主干导航项 */}
          <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
            <NavLink to="/" end className={navClass} title={collapsed ? "动态" : undefined}>
              <MomentIcon size="nav" />
              {!collapsed && <span>动态</span>}
            </NavLink>

            <NavLink to="/albums" className={navClass} title={collapsed ? "相册" : undefined}>
              <AlbumIcon size="nav" />
              {!collapsed && <span>相册</span>}
            </NavLink>

            <NavLink to="/letter" className={navClass} title={collapsed ? "信箱" : undefined}>
              <LetterIcon size="nav" />
              {!collapsed && <span>信箱</span>}
            </NavLink>

            <NavLink to="/us" className={navClass} title={collapsed ? "我们" : undefined}>
              <UsIcon size="nav" />
              {!collapsed && <span>我们</span>}
            </NavLink>
          </nav>

          {/* 底部账户 */}
          <UserAccount collapsed={collapsed} />
        </aside>

        {/* 主内容区域（包含顶部工具栏与主画布） */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {!isImmersiveRoute && (
            <header className="orbit-header-bar shrink-0 flex items-center justify-between px-4 bg-[var(--color-surface)] border-b border-[var(--color-border-light)] min-h-[3.5rem]">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentTitle && (
                  <span className="font-heading font-medium text-sm text-[var(--color-text-primary)] tracking-wide truncate select-none">
                    {currentTitle}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <button
                  type="button"
                  onClick={openSearch}
                  className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
                  title="搜索 (⌘K)"
                  aria-label="搜索 (⌘K)"
                >
                  <SearchIcon size="sm" />
                </button>
                <NotificationBell />
                <button
                  type="button"
                  onClick={cycleTheme}
                  aria-label={`当前主题: ${theme}，点击切换`}
                  title={theme === "light" ? "浅色模式" : theme === "dark" ? "深色模式" : "跟随系统"}
                  className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
                >
                  {theme === "dark" ? <MoonIcon size="sm" /> : theme === "system" ? <MonitorIcon size="sm" /> : <SunIcon size="sm" />}
                </button>
              </div>
            </header>
          )}

          {/* 内容主画布 */}
          <main
            ref={mainRef}
            className={[
              "flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-y-auto",
              isImmersiveRoute ? "bg-[var(--color-surface)]" : "bg-[var(--color-bg)]",
            ].join(" ")}
          >
            <RouteErrorBoundary>
              <Suspense fallback={null}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </main>
        </div>
      </div>

      {/* 模态浮层 */}
      <SearchModal isOpen={searchOpen} onClose={closeSearch} />
      {aiMounted && (
        <AiChatPanel
          open={aiOpen}
          onClose={closeAi}
          context={aiContext}
          articleTitle={aiArticleTitle}
          articleType={aiArticleType}
        />
      )}
      <AiChatFab
        open={aiOpen}
        onClick={() => {
          setAiMounted(true);
          if (aiOpen) closeAi();
          else openAi();
        }}
      />
      <PwaInstallGuideModal isOpen={guideOpen} onClose={closeGuide} />
    </div>
  );
}
