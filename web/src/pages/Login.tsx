import { useState, useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { TurnstileWidget } from "../components/TurnstileWidget";
import { authClient, fetchSpaceStatus, type SpaceStatus } from "../lib/api";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";

import { EyeIcon, EyeOffIcon } from "../components/OrbitIcons";

type Mode = "signin" | "signup";

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { data: session, isPending, refetch } = authClient.useSession();
  const [mode, setMode] = useState<Mode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [spaceStatus, setSpaceStatus] = useState<SpaceStatus | null>(null);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || "";

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    "/";

  useEffect(() => {
    setPageTitle("登录");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchSpaceStatus()
      .then((status) => {
        if (!cancelled) setSpaceStatus(status);
      })
      .catch(() => {
        if (!cancelled) setSpaceStatus({ userCount: 0, signupOpen: true, authors: [] });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (spaceStatus && !spaceStatus.signupOpen && mode === "signup") {
      setMode("signin");
    }
  }, [spaceStatus, mode]);

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

  const signupOpen = spaceStatus?.signupOpen ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (turnstileSiteKey && !turnstileToken) {
      toast.error("请先完成真人身份验证");
      return;
    }

    setLoading(true);

    const headers: Record<string, string> = {};
    if (turnstileToken) {
      headers["x-turnstile-token"] = turnstileToken;
    }

    try {
      if (mode === "signin") {
        const { error } = await authClient.signIn.email({
          email,
          password,
          fetchOptions: { credentials: "include", headers },
        });
        if (error) {
          const msg =
            error.message ||
            (error as { statusText?: string }).statusText ||
            "邮箱或密码错误，请重试";
          toast.error(msg);
          return;
        }
      } else {
        if (!displayName.trim()) {
          toast.error("请填写你的爱称");
          return;
        }
        const { error } = await authClient.signUp.email({
          name: displayName.trim(),
          email,
          password,
          fetchOptions: { credentials: "include", headers },
        });
        if (error) {
          toast.error(
            error.message?.includes("closed") || error.message?.includes("注册")
              ? "开放注册已关闭，请通过邀请链接加入"
              : error.message || "注册失败，请检查信息后重试"
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
          {signupOpen ? (
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
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && signupOpen ? (
              <div className="orbit-auth-field">
                <label className="orbit-auth-label" htmlFor="login-name">
                  你的爱称
                </label>
                <input
                  id="login-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="例如：小圆"
                  required
                  maxLength={16}
                  className="orbit-input"
                  autoComplete="nickname"
                />
                <p className="orbit-auth-hint">用于内容署名，注册后可随时修改</p>
              </div>
            ) : null}

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
              <div className="orbit-password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 8 位"
                  required
                  minLength={8}
                  className="orbit-input"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  className="orbit-password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  title={showPassword ? "隐藏密码" : "显示密码"}
                >
                  {showPassword ? <EyeOffIcon size="sm" /> : <EyeIcon size="sm" />}
                </button>
              </div>
            </div>

            {turnstileSiteKey ? (
              <TurnstileWidget
                siteKey={turnstileSiteKey}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken("")}
                onError={() => setTurnstileToken("")}
              />
            ) : null}

            <button
              type="submit"
              disabled={loading || (Boolean(turnstileSiteKey) && !turnstileToken)}
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
