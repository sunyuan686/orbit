import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ArticleList } from "./pages/ArticleList";
import { ArticleView } from "./pages/ArticleView";
import { ArticleEdit } from "./pages/ArticleEdit";
import { Login } from "./pages/Login";
import { Join } from "./pages/Join";
import { SearchPage } from "./pages/Search";
import { GalleryPage } from "./pages/Gallery";
import { ActivityPage } from "./pages/Activity";
import { HomePage } from "./pages/Home";
import { SettingsPage } from "./pages/Settings";

export default function App() {
  return (
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
  );
}
