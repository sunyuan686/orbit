import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { RequireAuth } from "./components/RequireAuth";
import { ArticleList } from "./pages/ArticleList";
import { ArticleView } from "./pages/ArticleView";
import { ArticleEdit } from "./pages/ArticleEdit";
import { Login } from "./pages/Login";
import { SearchPage } from "./pages/Search";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="/diary" replace />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/:type" element={<ArticleList />} />
        <Route path="/:type/new" element={<ArticleEdit />} />
        <Route path="/:type/:id" element={<ArticleView />} />
        <Route path="/:type/:id/edit" element={<ArticleEdit />} />
      </Route>
    </Routes>
  );
}
