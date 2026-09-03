import { useCallback } from "react";
import { usePwaUpdate } from "../hooks/usePwaUpdate";

/**
 * PWA 版本更新提示（prompt 模式）。
 *
 * 更新契约：新 SW 安装后 waiting，不自动接管；
 * 页面弹出「新版本可用」提示，用户点击「立即刷新」后才激活新 SW 并整页重载。
 * 整页重载是破坏性操作（编辑中草稿、刮刮卡状态会丢失），
 * 其决策权属于用户，由用户选择安全时机执行。
 */
export function SwUpdatePrompt() {
  const { needRefresh, dismissed, applyUpdate, setDismissed } = usePwaUpdate();

  const handleUpdate = useCallback(() => {
    void applyUpdate();
  }, [applyUpdate]);

  const handleClose = useCallback(() => {
    setDismissed(true);
  }, [setDismissed]);

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
