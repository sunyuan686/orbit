import { useState, useEffect } from "react";
import { Turnstile } from "@marsidev/react-turnstile";

interface TurnstileWidgetProps {
  siteKey: string;
  onSuccess: (token: string) => void;
  onExpire: () => void;
  onError?: (error?: unknown) => void;
}

export function TurnstileWidget({
  siteKey,
  onSuccess,
  onExpire,
  onError,
}: TurnstileWidgetProps) {
  const [loadError, setLoadError] = useState(false);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateTheme = () => {
      const isDark = document.documentElement.classList.contains("dark");
      setResolvedTheme(isDark ? "dark" : "light");
    };
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // 监测 5 秒内 Cloudflare turnstile 脚本是否正常注入并运行
    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && !window.turnstile) {
        setLoadError(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  if (loadError) {
    return (
      <div className="orbit-turnstile-error">
        ⚠️ 无法加载 Cloudflare 验证服务
        <br />
        <span className="orbit-turnstile-error-sub">
          请检查网络连接或关闭浏览器广告拦截插件（如 uBlock / AdGuard）后刷新页面
        </span>
      </div>
    );
  }

  return (
    <div className="orbit-turnstile-container">
      <Turnstile
        key={resolvedTheme}
        siteKey={siteKey}
        options={{
          theme: resolvedTheme,
        }}
        onSuccess={(token) => {
          setLoadError(false);
          onSuccess(token);
        }}
        onExpire={onExpire}
        onError={(err) => {
          setLoadError(true);
          onError?.(err);
        }}
      />
    </div>
  );
}
