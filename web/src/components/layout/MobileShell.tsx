import { useState, useEffect, useRef, Suspense } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { TabBar } from "./TabBar";
import { QuickComposeSheet } from "./QuickComposeSheet";
import { SearchIcon, MenuIcon } from "../OrbitIcons";
import { AiChatFab } from "../AiChatFab";
import { UsMenuSheet } from "../UsMenuSheet";
import { NotificationBell } from "../NotificationBell";
import { SearchModal } from "../SearchModal";
import { AiChatPanel, type AiChatContext } from "../AiChatPanel";
import { RouteErrorBoundary } from "../RouteErrorBoundary";
import { PwaInstallGuideModal } from "../PwaInstallGuideModal";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { useLayer } from "../../hooks/useLayer";
import { useScrollRestoration } from "../../hooks/useScrollRestoration";
import { setPageTitle } from "../../lib/pageTitle";

export function MobileShell() {
  const [aiMounted, setAiMounted] = useState(false);
  const { isOpen: searchOpen, open: openSearch, close: closeSearch } = useLayer("search");
  const {
    isOpen: quickComposeOpen,
    open: openCompose,
    close: closeCompose,
  } = useLayer("compose");
  const { isOpen: aiOpen, open: openAi, close: closeAi } = useLayer("ai");
  const {
    isOpen: usMenuOpen,
    open: openUsMenu,
    close: closeUsMenu,
  } = useLayer("us-menu");
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { guideOpen, closeGuide } = usePwaInstall();
  const mainRef = useRef<HTMLElement>(null);
  useScrollRestoration(mainRef);

  const segments = location.pathname.split("/").filter(Boolean);
  const isEntryDetailRoute =
    segments.length === 2 &&
    (segments[0] === "moment" || segments[0] === "letter") &&
    segments[1] !== "new";
  const isEditorRoute =
    location.pathname.endsWith("/edit") ||
    (segments.length >= 2 && segments[1] === "new");
  const isImmersive = isEditorRoute || isEntryDetailRoute;
  const isUsSection = ["us", "settings", "memories", "activity"].includes(segments[0]);

  useEffect(() => {
    const pathSegments = location.pathname.split("/").filter(Boolean);
    const segment = pathSegments[0];
    if (!segment) {
      setPageTitle("首页");
      return;
    }
    if (segment === "moment") setPageTitle("动态");
    else if (segment === "albums" || segment === "gallery") setPageTitle("相册");
    else if (segment === "letter") setPageTitle("信箱");
    else if (segment === "us" || segment === "space") setPageTitle("我们");
    else if (segment === "memories") setPageTitle("记忆星图");
    else if (segment === "settings") setPageTitle("设置");
    else if (segment === "search") setPageTitle("搜索");
  }, [location.pathname]);

  // 获取移动端顶部标题文案
  const getHeaderTitle = () => {
    const segment = segments[0];
    if (!segment) return "Orbit";
    if (segment === "moment") return "动态";
    if (segment === "albums" || segment === "gallery") return "相册";
    if (segment === "letter") return "信箱";
    if (segment === "us" || segment === "space") return "我们";
    if (segment === "memories") return "记忆星图";
    if (segment === "settings") return "系统设置";
    if (segment === "search") return "搜索";
    return "Orbit";
  };

  const aiContext: AiChatContext = isEntryDetailRoute
    ? { mode: "article", articleId: segments[1] }
    : { mode: "global" };

  return (
    <div className="orbit-shell flex flex-col antialiased">
      {/* 移动端极简顶部状态栏（沉浸式编辑时隐藏，严格避让手机系统状态栏） */}
      {!isImmersive && (
        <header
          className="orbit-header-bar shrink-0 relative flex items-center px-4 bg-[var(--color-surface)]/95 backdrop-blur-md"
          style={{
            paddingTop: "max(env(safe-area-inset-top, 0px), 0.625rem)",
            minHeight: "calc(3.5rem + env(safe-area-inset-top, 0px))",
          }}
        >
          {/* 左侧操作区 */}
          <div className="flex items-center gap-1 relative z-10">
            {isUsSection && (
              <button
                type="button"
                onClick={openUsMenu}
                aria-label="更多选项"
                className="p-2 -ml-1 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
              >
                <MenuIcon size="sm" />
              </button>
            )}
          </div>

          {/* 居中标题（绝对定位，永远居中） */}
          <div
            className="absolute inset-x-0 inset-y-0 flex items-center justify-center pointer-events-none"
            style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 0.625rem)" }}
          >
            <span className="font-heading font-semibold text-base text-[var(--color-text-primary)] tracking-tight truncate max-w-[180px]">
              {getHeaderTitle()}
            </span>
          </div>

          {/* 右侧操作区 */}
          <div className="flex items-center gap-1 ml-auto relative z-10">
            <NotificationBell />
            <button
              type="button"
              onClick={openSearch}
              aria-label="搜索"
              className="p-2 -mr-1 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            >
              <SearchIcon size="sm" />
            </button>
          </div>
        </header>
      )}

      {/* 主内容区域：统一 16px 边距与底部 TabBar 避让空间 */}
      <main
        ref={mainRef}
        className={`flex-1 min-h-0 overflow-y-auto overscroll-y-contain px-4 ${
          isImmersive
            ? "pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
            : "py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
        }`}
      >
        <RouteErrorBoundary>
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </RouteErrorBoundary>
      </main>

      {/* 移动端原生底栏（全屏/沉浸式编辑时隐藏） */}
      {!isImmersive && (
        <TabBar
          onComposeClick={() => {
            if (location.pathname.startsWith("/letter")) {
              navigate("/letter/new");
            } else {
              openCompose();
            }
          }}
        />
      )}

      {/* 移动端半屏即时创作抽屉 */}
      <QuickComposeSheet
        isOpen={quickComposeOpen}
        onClose={closeCompose}
        onPosted={() => {
          queryClient.invalidateQueries({ queryKey: ["entries"] });
          // 已在首页则原地关层；否则用 replace 把层条目换成首页，返回时不会浮出抽屉。
          if (location.pathname === "/") closeCompose();
          else navigate("/", { replace: true });
        }}
      />

      {/* 搜索与 AI 面板 */}
      <SearchModal isOpen={searchOpen} onClose={closeSearch} />
      {!isImmersive && (
        <AiChatFab
          open={aiOpen}
          onClick={() => {
            setAiMounted(true);
            if (aiOpen) closeAi();
            else openAi();
          }}
        />
      )}
      {aiMounted && (
        <AiChatPanel
          open={aiOpen}
          onClose={closeAi}
          context={aiContext}
        />
      )}
      <PwaInstallGuideModal isOpen={guideOpen} onClose={closeGuide} />
      <UsMenuSheet isOpen={usMenuOpen} onClose={closeUsMenu} />
    </div>
  );
}
