import { useState, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { authClient } from "../lib/api";
import { CANONICAL_AUTHORS, type CanonicalAuthor } from "../lib/authors";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";

type Mode = "signin" | "signup";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { data: session, isPending, refetch } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [author, setAuthor] = useState<CanonicalAuthor | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    "/diary";

  useEffect(() => {
    setPageTitle("登录");
  }, []);

  if (isPending) {
    return (
      <div className="orbit-auth-page">
        <p className="orbit-muted">加载中…</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signin") {
        const { error } = await authClient.signIn.email({
          email,
          password,
          fetchOptions: { credentials: "include" },
        });
        if (error) {
          toast.error("邮箱或密码错误，请重试");
          return;
        }
      } else {
        if (!author) {
          toast.error("请选择你的身份：小圆子或小麟子");
          return;
        }
        const { error } = await authClient.signUp.email({
          name: author,
          email,
          password,
          fetchOptions: { credentials: "include" },
        });
        if (error) {
          toast.error(
            error.message?.includes("closed")
              ? "注册已关闭，这里只为两个人准备"
              : error.message?.includes("小圆子") || error.message?.includes("身份")
                ? "请选择身份：小圆子或小麟子"
                : "注册失败，请检查信息后重试"
          );
          return;
        }
      }
      toast.success(mode === "signin" ? "已登录" : "已注册");
      await refetch();
      navigate(from, { replace: true });
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="orbit-auth-page">
      <div className="orbit-auth-wrap">
        <div>
          <h1 className="orbit-auth-brand">Orbit</h1>
          <p className="orbit-auth-tagline">属于两个人的空间</p>
        </div>

        <div className="orbit-auth-panel">
          <div className="orbit-auth-tabs" role="tablist" aria-label="登录或注册">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`orbit-auth-tab${mode === m ? " orbit-auth-tab--active" : ""}`}
              >
                {m === "signin" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="orbit-auth-field">
                <span className="orbit-auth-label">身份</span>
                <div className="orbit-auth-choices">
                  {CANONICAL_AUTHORS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAuthor(value)}
                      className={`orbit-auth-choice${author === value ? " orbit-auth-choice--active" : ""}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p className="orbit-auth-hint">注册后用于内容署名，与另一位不可重复</p>
              </div>
            )}

            <div className="orbit-auth-field">
              <label className="orbit-auth-label" htmlFor="login-email">
                邮箱
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="orbit-input"
                autoComplete="email"
              />
            </div>

            <div className="orbit-auth-field">
              <label className="orbit-auth-label" htmlFor="login-password">
                密码
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
                required
                minLength={8}
                className="orbit-input"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="orbit-btn orbit-btn-primary orbit-auth-submit"
            >
              {loading ? "处理中…" : mode === "signin" ? "登录" : "注册"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
