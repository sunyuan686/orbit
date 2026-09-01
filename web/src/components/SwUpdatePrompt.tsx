import { useCallback, useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

/**
 * PWA 版本更新提示（prompt 模式）。
 *
 * 更新契约：新 SW 安装后 waiting，不自动接管；
 * 页面弹出「新版本可用」提示，用户点击「立即刷新」后才激活新 SW 并整页重载。
 * 整页重载是破坏性操作（编辑中草稿、刮刮卡状态会丢失），
 * 其决策权属于用户，由用户选择安全时机执行。
 */

let registered = false;
let lastCheckTime = 0;
const CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 分钟节流阈值

function checkForUpdates(registration: ServiceWorkerRegistration) {
  const now = Date.now();
  if (now - lastCheckTime < CHECK_INTERVAL_MS) return;
  lastCheckTime = now;
  registration.update().catch((err) => {
    console.warn("[pwa] Failed to check for SW update", err);
  });
}

export function SwUpdatePrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const updateSwRef = useRef<((reloadPage?: boolean) => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator) || registered) {
      return;
    }
    registered = true;

    const updateSW = registerSW({
      immediate: true,
      onRegisteredSW(_swScriptUrl, registration) {
        if (!registration) return;
        lastCheckTime = Date.now();

        // App 从后台切回前台或聚焦时，节流检查是否有新版本
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            checkForUpdates(registration);
          }
        });
        window.addEventListener("focus", () => checkForUpdates(registration));
      },
      onOfflineReady() {
        console.info("[pwa] App shell cached for offline use");
      },
      onNeedRefresh() {
        setNeedRefresh(true);
        setDismissed(false);
      },
      onRegisterError(error) {
        console.error("[pwa] Service worker registration failed", error);
      },
    });
    updateSwRef.current = updateSW;
  }, []);

  const handleUpdate = useCallback(() => {
    // 发送 SKIP_WAITING → 新 SW 激活接管 → 运行时自动整页重载
    void updateSwRef.current?.(true);
  }, []);

  const handleClose = useCallback(() => {
    setDismissed(true);
  }, []);

  if (!needRefresh || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: "max(1.5rem, env(safe-area-inset-bottom))",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        maxWidth: "calc(100vw - 2rem)",
        padding: "0.625rem 1rem",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "var(--shadow-float)",
      }}
    >
      <span
        style={{
          fontSize: "var(--type-secondary)",
          color: "var(--color-text-primary)",
          whiteSpace: "nowrap",
        }}
      >
        新版本可用
      </span>
      <button
        type="button"
        className="orbit-btn orbit-btn-primary orbit-btn-sm"
        onClick={handleUpdate}
      >
        立即刷新
      </button>
      <button
        type="button"
        className="orbit-icon-btn"
        onClick={handleClose}
        aria-label="暂不更新"
        title="暂不更新"
        style={{ flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path
            d="M2 2l10 10M12 2L2 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
