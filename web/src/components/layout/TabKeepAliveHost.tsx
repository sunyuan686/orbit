import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Outlet, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "../RouteErrorBoundary";
import { getActiveTabKey, type TabKey } from "../../lib/tabNavigation";
import { useScrollRestoration } from "../../hooks/useScrollRestoration";

const HomePage = lazy(() =>
  import("../../pages/Home").then((m) => ({ default: m.HomePage }))
);
const AlbumsPage = lazy(() =>
  import("../../pages/Albums").then((m) => ({ default: m.AlbumsPage }))
);
const ArticleList = lazy(() =>
  import("../../pages/ArticleList").then((m) => ({ default: m.ArticleList }))
);
const UsPage = lazy(() =>
  import("../../pages/Us").then((m) => ({ default: m.UsPage }))
);

export interface TabKeepAliveHostProps {
  isMobile: boolean;
  isImmersive?: boolean;
}

export function TabKeepAliveHost({ isMobile, isImmersive = false }: TabKeepAliveHostProps) {
  const location = useLocation();
  const activeTab = getActiveTabKey(location.pathname);
  const isTabRoute = activeTab !== null;

  // 懒加载记录已访问的 Tab，未曾点击的 Tab 不预先挂载，减小首屏开销
  const [visitedTabs, setVisitedTabs] = useState<Set<TabKey>>(() => {
    return activeTab ? new Set<TabKey>([activeTab]) : new Set<TabKey>(["moment"]);
  });

  // 官方推荐的就地状态调整（避免在 useEffect 中同步 setState 产生级联二次渲染）
  if (activeTab && !visitedTabs.has(activeTab)) {
    const next = new Set(visitedTabs);
    next.add(activeTab);
    setVisitedTabs(next);
  }

  // 各 Tab 独立的原生滚动视口引用
  const viewportRefs = useRef<Record<TabKey, HTMLDivElement | null>>({
    moment: null,
    albums: null,
    letter: null,
    us: null,
  });

  // 次级页面滚动视口引用与第一性原理恢复机制
  const subpageViewportRef = useRef<HTMLDivElement | null>(null);
  useScrollRestoration(subpageViewportRef);

  // 支持重复点击当前 Tab 时，原生平滑滚动回顶部
  useEffect(() => {
    const handleScrollToTop = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab: TabKey }>;
      const targetTab = customEvent.detail?.tab;
      const targetEl = targetTab ? viewportRefs.current[targetTab] : null;
      if (targetEl) {
        if (targetEl.scrollTop > 10) {
          targetEl.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          // 若已在顶部，重复点击直接触发当前 Tab 刷新
          window.dispatchEvent(
            new CustomEvent("orbit:refresh-active-tab", {
              detail: { tab: targetTab },
            })
          );
        }
      }
    };

    window.addEventListener("orbit:scroll-tab-to-top", handleScrollToTop);
    return () => {
      window.removeEventListener("orbit:scroll-tab-to-top", handleScrollToTop);
    };
  }, []);

  // 移动端与桌面端的内边距区分（第一性原理：桌面端由 Container 统一管理内边距，消除视口双重嵌套 padding；移动端保留底部避让底栏）
  const tabPaddingClass = isMobile
    ? "px-4 py-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]"
    : "";

  const subpagePaddingClass = isMobile
    ? isImmersive
      ? "px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
      : "px-4 py-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]"
    : isImmersive
      ? "bg-[var(--color-surface)]"
      : "bg-[var(--color-bg)]";

  const renderTabContent = (key: TabKey): ReactNode => {
    switch (key) {
      case "moment":
        return <HomePage />;
      case "albums":
        return <AlbumsPage />;
      case "letter":
        return <ArticleList typeOverride="letter" />;
      case "us":
        return <UsPage />;
    }
  };

  return (
    <div className="orbit-tab-host relative w-full h-full min-h-0 flex-1 overflow-hidden">
      {/* 4 大主支柱视图层：常驻保活在 DOM 中，通过 visibility: hidden 保持原生盒模型与 scrollTop */}
      {Array.from(visitedTabs).map((key) => {
        const isActive = activeTab === key;
        return (
          <div
            key={key}
            ref={(node) => {
              viewportRefs.current[key] = node;
            }}
            data-tab={key}
            className={[
              "orbit-tab-viewport absolute inset-0 overflow-y-auto overscroll-y-contain",
              tabPaddingClass,
              isActive ? "z-10" : "z-0 pointer-events-none",
            ].join(" ")}
            style={{
              visibility: isActive ? "visible" : "hidden",
            }}
          >
            <Suspense fallback={null}>
              {renderTabContent(key)}
            </Suspense>
          </div>
        );
      })}

      {/* 次级页面（详情页、全屏编辑、系统设置等）：通过 Outlet 栈式渲染 */}
      {!isTabRoute && (
        <div
          ref={subpageViewportRef}
          className={[
            "orbit-subpage-viewport absolute inset-0 z-20 overflow-y-auto overscroll-y-contain bg-[var(--color-bg)]",
            subpagePaddingClass,
          ].join(" ")}
        >
          <RouteErrorBoundary>
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          </RouteErrorBoundary>
        </div>
      )}
    </div>
  );
}
