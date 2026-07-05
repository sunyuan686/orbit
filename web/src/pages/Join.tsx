import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import {
  acceptInvite,
  authClient,
  fetchInviteToken,
  getApiErrorMessage,
  shouldToastApiError,
} from "../lib/api";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";

export function Join() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const { data: session, isPending, refetch } = authClient.useSession();

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [inviterName, setInviterName] = useState<string | null>(null);
  const [inviteInvalid, setInviteInvalid] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setPageTitle("加入空间");
  }, []);

  useEffect(() => {
    if (!token) {
      setInviteInvalid("缺少邀请链接");
      setLoadingInvite(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingInvite(true);
      try {
        const preview = await fetchInviteToken(token);
        if (cancelled) return;
        if (!preview.valid) {
          setInviteInvalid(
            preview.reason === "expired"
              ? "邀请已过期"
              : preview.reason === "full"
                ? "空间已满员"
                : "邀请无效或已使用"
          );
          return;
        }
        setInviterName(preview.inviterName ?? "对方");
      } catch (err) {
        if (!cancelled && shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "无法加载邀请"));
        }
        if (!cancelled) setInviteInvalid("无法加载邀请");
      } finally {
        if (!cancelled) setLoadingInvite(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, toast]);

  if (isPending || loadingInvite) {
    return (
      <div className="orbit-auth-page">
        <p className="orbit-muted">加载中…</p>
      </div>
    );
  }

  if (session) {
    return <Navigate to="/" replace />;
  }

  if (!token || inviteInvalid) {
    return (
      <div className="orbit-auth-page">
        <div className="orbit-auth-wrap">
          <h1 className="orbit-auth-brand">Orbit</h1>
          <p className="orbit-auth-tagline">{inviteInvalid ?? "邀请无效"}</p>
          <Link to="/login" className="orbit-btn orbit-btn-primary orbit-auth-submit">
            去登录
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await acceptInvite(token, {
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
        fetchOptions: { credentials: "include" },
      });
      if (error) {
        toast.error("账号已创建，请手动登录");
        navigate("/login", { replace: true });
        return;
      }
      toast.success("欢迎加入");
      await refetch();
      navigate("/", { replace: true });
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加入失败，请检查信息后重试"));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="orbit-auth-page">
      <div className="orbit-auth-wrap">
        <div>
          <h1 className="orbit-auth-brand">Orbit</h1>
          <p className="orbit-auth-tagline">
            {inviterName ? `${inviterName} 邀请你加入` : "加入情侣空间"}
          </p>
        </div>

        <div className="orbit-auth-panel">
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="orbit-auth-field">
              <label className="orbit-auth-label" htmlFor="join-name">
                你的爱称
              </label>
              <input
                id="join-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如：小圆"
                required
                maxLength={16}
                className="orbit-input"
                autoComplete="nickname"
              />
              <p className="orbit-auth-hint">用于内容署名，可与对方不重复</p>
            </div>

            <div className="orbit-auth-field">
              <label className="orbit-auth-label" htmlFor="join-email">
                邮箱
              </label>
              <input
                id="join-email"
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
              <label className="orbit-auth-label" htmlFor="join-password">
                密码
              </label>
              <input
                id="join-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
                required
                minLength={8}
                className="orbit-input"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="orbit-btn orbit-btn-primary orbit-auth-submit"
            >
              {submitting ? "处理中…" : "加入空间"}
            </button>
          </form>

          <p className="orbit-auth-hint" style={{ marginTop: "1rem", textAlign: "center" }}>
            已有账号？<Link to="/login">登录</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
