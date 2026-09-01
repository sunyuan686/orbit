import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { SwUpdatePrompt } from "./components/SwUpdatePrompt";

const Login = lazy(() =>
  import("./pages/Login").then((m) => ({ default: m.Login }))
);
const Join = lazy(() =>
  import("./pages/Join").then((m) => ({ default: m.Join }))
);
const HomePage = lazy(() =>
  import("./pages/Home").then((m) => ({ default: m.HomePage }))
);
const MemoriesPage = lazy(() =>
  import("./pages/Memories").then((m) => ({ default: m.MemoriesPage }))
);
const ActivityPage = lazy(() =>
  import("./pages/Activity").then((m) => ({ default: m.ActivityPage }))
);
const SearchPage = lazy(() =>
  import("./pages/Search").then((m) => ({ default: m.SearchPage }))
);
const GalleryPage = lazy(() =>
  import("./pages/Gallery").then((m) => ({ default: m.GalleryPage }))
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

export default function App() {
  // fallback 为 null：lazy chunk 加载期间 App shell 启动屏（index.html #orbit-boot）
  // 仍在页面最上层覆盖，由 lib/bootScreen.ts 统一淡出，避免启动屏卸载重建闪烁。
  // SwUpdatePrompt 位于路由之外：登录页/加入页同样受版本更新提示覆盖。
  return (
    <>
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/join" element={<Join />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          <Route path="/memories" element={<MemoriesPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/:type" element={<ArticleList />} />
          <Route path="/:type/new" element={<ArticleEdit />} />
          <Route path="/:type/:id" element={<ArticleView />} />
          <Route path="/:type/:id/edit" element={<ArticleEdit />} />
        </Route>
      </Routes>
    </Suspense>
    <SwUpdatePrompt />
    </>
  );
}
