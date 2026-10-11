import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { TabBar } from "./TabBar";
import { QuickComposeSheet } from "./QuickComposeSheet";
import { SearchIcon, MenuIcon, ArrowLeftIcon } from "../OrbitIcons";
import { AiChatFab } from "../AiChatFab";
import { UsMenuSheet } from "../UsMenuSheet";
import { NotificationBell } from "../NotificationBell";
import { SearchModal } from "../SearchModal";
import { AiChatPanel, type AiChatContext } from "../AiChatPanel";
import { PwaInstallGuideModal } from "../PwaInstallGuideModal";
import { usePwaInstall } from "../../hooks/usePwaInstall";
import { useLayer } from "../../hooks/useLayer";
import { setPageTitle } from "../../lib/pageTitle";
import { TabKeepAliveHost } from "./TabKeepAliveHost";
import { getActiveTabKey } from "../../lib/tabNavigation";

const SETTINGS_TAB_TITLES: Record<string, string> = {
  profile: "个人资料",
  security: "登录与安全",
  appearance: "主题风格",
  space: "空间档案",
  integrations: "连接集成",
  notifications: "通知偏好",
  companion: "共度时光",
  "api-tokens": "API 凭证",
  about: "关于 Orbit",
};

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

  const segments = location.pathname.split("/").filter(Boolean);
  const activeTabKey = getActiveTabKey(location.pathname);
  const isRootTab = activeTabKey !== null;

  const isAlbumDetailRoute = segments.length === 2 && segments[0] === "albums";
  const isEntryDetailRoute =
    segments.length === 2 &&
    segments[0] !== "albums" &&
    segments[0] !== "settings" &&
    segments[1] !== "new";
  const isEditorRoute =
    location.pathname.endsWith("/edit") ||
    (segments.length >= 2 && segments[1] === "new");
  const isImmersive = isEditorRoute || isEntryDetailRoute || isAlbumDetailRoute;

  // 获取移动端顶部标题文案
  const getHeaderTitle = () => {
    const segment = segments[0];
    if (!segment) return "Orbit";
    if (segment === "moment") return "动态";
    if (segment === "albums" || segment === "gallery") return "相册";
    if (segment === "letter") return "信箱";
    if (segment === "us" || segment === "space") return "我们";
    if (segment === "memories") return "记忆星图";
    if (segment === "settings") {
      const tab = new URLSearchParams(location.search).get("tab");
      return (tab && SETTINGS_TAB_TITLES[tab]) || "系统设置";
    }
    if (segment === "search") return "搜索";
    return "Orbit";
  };

  useEffect(() => {
    const title = getHeaderTitle();
    setPageTitle(title === "Orbit" ? "首页" : title);
  }, [location.pathname, location.search]);

  const aiContext: AiChatContext = isEntryDetailRoute
    ? { mode: "article", articleId: segments[1] }
    : { mode: "global" };

  return (
    <div className="orbit-shell flex flex-col antialiased">
      {/* 移动端极简顶部状态栏（沉浸式编辑/详情时隐藏，严格避让手机系统状态栏） */}
      {!isImmersive && (
        <header
          className="orbit-header-bar shrink-0 relative flex items-center px-4 bg-[var(--color-surface)]/95 backdrop-blur-md"
          style={{
            paddingTop: "max(env(safe-area-inset-top, 0px), 0.625rem)",
            minHeight: "calc(3.5rem + env(safe-area-inset-top, 0px))",
          }}
        >
          {/* 左侧操作区：根 Tab 仅在「我们」显示侧边抽屉，其余次级页面统一显示返回键 */}
          <div className="flex items-center gap-1 relative z-10">
            {isRootTab ? (
              activeTabKey === "us" && (
                <button
                  type="button"
                  onClick={openUsMenu}
                  aria-label="更多选项"
                  className="p-2 -ml-1 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
                >
                  <MenuIcon size="sm" />
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => navigate(-1)}
                aria-label="返回"
                className="p-2 -ml-1 rounded-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
              >
                <ArrowLeftIcon size="sm" />
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

      {/* 主内容视口托管容器（四主支柱保活与子页面视口独立隔离） */}
      <main className="flex-1 min-h-0 relative w-full h-full overflow-hidden">
        <TabKeepAliveHost isMobile={true} isImmersive={isImmersive} />
      </main>

      {/* 移动端原生底栏（仅在四大主支柱根视图显示，次级页面深入时自然隐藏） */}
      {isRootTab && (
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
      {isRootTab && (
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
