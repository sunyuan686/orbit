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
      <div className="min-h-screen flex items-center justify-center text-stone-500">
        加载中…
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
      toast.success(mode === "signin" ? "登录成功" : "注册成功");
      await refetch();
      navigate(from, { replace: true });
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-stone-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-light text-stone-800 dark:text-stone-200 tracking-wide">
            Orbit
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-500">
            属于两个人的空间
          </p>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl shadow-sm border border-stone-200 dark:border-stone-800 p-8">
          {/* 模式切换 */}
          <div className="flex rounded-lg border border-stone-200 dark:border-stone-700 p-1 mb-6">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={[
                  "flex-1 py-2 rounded-md text-sm font-medium transition-all",
                  mode === m
                    ? "bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900"
                    : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-300",
                ].join(" ")}
              >
                {m === "signin" ? "登录" : "注册"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                  身份
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CANONICAL_AUTHORS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAuthor(value)}
                      className={[
                        "py-3 rounded-xl border text-sm font-medium transition-colors",
                        author === value
                          ? "border-stone-800 dark:border-stone-200 bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900"
                          : "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-400",
                      ].join(" ")}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-stone-400 dark:text-stone-500">
                  注册后用于内容署名，与另一位不可重复
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 8 位"
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-900 dark:text-stone-100 text-base focus:outline-none focus:ring-2 focus:ring-stone-400 dark:focus:ring-stone-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 text-sm font-medium hover:bg-stone-700 dark:hover:bg-stone-300 disabled:opacity-50 transition-colors mt-2"
            >
              {loading ? "处理中…" : mode === "signin" ? "登录" : "注册"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
