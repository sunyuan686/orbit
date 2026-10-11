import { lazy, Suspense, useEffect } from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Outlet,
  Route,
  RouterProvider,
} from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { SwUpdatePrompt } from "./components/SwUpdatePrompt";
import { NavigationBootstrap } from "./components/NavigationBootstrap";
import { LightboxHost } from "./components/LightboxHost";

const Login = lazy(() =>
  import("./pages/Login").then((m) => ({ default: m.Login }))
);
const Join = lazy(() =>
  import("./pages/Join").then((m) => ({ default: m.Join }))
);
const AlbumDetailPage = lazy(() =>
  import("./pages/AlbumDetail").then((m) => ({ default: m.AlbumDetailPage }))
);
const MemoriesPage = lazy(() =>
  import("./pages/Memories").then((m) => ({ default: m.MemoriesPage }))
);
const SearchPage = lazy(() =>
  import("./pages/Search").then((m) => ({ default: m.SearchPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/Settings").then((m) => ({ default: m.SettingsPage }))
);
const ArticleList = lazy(() =>
  import("./pages/ArticleList").then((m) => ({ default: m.ArticleList }))
);
const ArticleView = lazy(() =>
  import("./pages/ArticleView").then((m) => ({ default: m.ArticleView }))
);
const ArticleEdit = lazy(() =>
  import("./pages/ArticleEdit").then((m) => ({ default: m.ArticleEdit }))
);

function RootShell() {
  // 空闲时预加载核心主支柱页面的 chunk，消除后续导航或侧滑返回时的网络拉取延迟
  useEffect(() => {
    const preload = () => {
      void import("./pages/Home");
      void import("./pages/ArticleView");
      void import("./pages/Albums");
      void import("./pages/AlbumDetail");
      void import("./pages/Us");
      void import("./pages/ArticleList");
      void import("./pages/ArticleEdit");
      void import("./pages/Memories");
      void import("./pages/Search");
      void import("./pages/Settings");
    };
    if (typeof window !== "undefined") {
      const win = window as Window & { requestIdleCallback?: (cb: () => void) => number };
      if (typeof win.requestIdleCallback === "function") {
        win.requestIdleCallback(preload);
      } else {
        setTimeout(preload, 1500);
      }
    }
  }, []);

  // fallback 为 null：lazy chunk 加载期间 App shell 启动屏（index.html #orbit-boot）
  // 仍在页面最上层覆盖，由 lib/bootScreen.ts 统一淡出，避免启动屏卸载重建闪烁。
  // SwUpdatePrompt 位于路由之外：登录页/加入页同样受版本更新提示覆盖。
  // NavigationBootstrap 同样位于路由之外：任何入口都先完成导航状态清理，再允许首帧绘制。
  // LightboxHost 也必须在路由之外：图片灯箱可由正文阅读态、编辑器、相册详情等多处发起，
  // 宿主放在路由内就会随页面切换卸载，层条目会被弹到一个无人渲染的位置。
  return (
    <>
      <NavigationBootstrap />
      <LightboxHost />
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
      <SwUpdatePrompt />
    </>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootShell />}>
      <Route path="/login" element={<Login />} />
      <Route path="/join" element={<Join />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={null} />
        <Route path="/moment" element={<Navigate to="/" replace />} />
        <Route path="/diary" element={<Navigate to="/" replace />} />
        <Route path="/timeline" element={<Navigate to="/" replace />} />
        <Route path="/message" element={<Navigate to="/" replace />} />
        <Route path="/memo" element={<Navigate to="/us" replace />} />
        <Route path="/albums" element={null} />
        <Route path="/albums/:id" element={<AlbumDetailPage />} />
        <Route path="/gallery" element={<Navigate to="/albums" replace />} />
        <Route path="/us" element={null} />
        <Route path="/space" element={<Navigate to="/us" replace />} />
        <Route path="/memories" element={<MemoriesPage />} />
        <Route path="/activity" element={<Navigate to="/memories" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/letter" element={null} />
        <Route path="/:type" element={<ArticleList />} />
        <Route path="/:type/new" element={<ArticleEdit />} />
        <Route path="/:type/:id" element={<ArticleView />} />
        <Route path="/:type/:id/edit" element={<ArticleEdit />} />
      </Route>
    </Route>
  )
);

export default function App() {
  return <RouterProvider router={router} />;
}
