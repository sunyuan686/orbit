import { useEffect } from "react";

export interface ActionSheetAction {
  label: string;
  /** 按钮样式变体，默认 default */
  variant?: "default" | "destructive" | "muted";
  /** 是否粗体，默认 false */
  bold?: boolean;
  onClick: () => void;
}

export interface ActionSheetDialogProps {
  open: boolean;
  title: string;
  description?: string;
  actions: ActionSheetAction[];
  /** 点击遮罩时触发，通常映射为「取消」动作 */
  onDismiss?: () => void;
}

/**
 * Jant 风格的操作确认弹窗（Action Sheet）。
 * 居中展示，带有半透明背景遮罩，按钮之间以分割线隔开。
 */
export function ActionSheetDialog({
  open,
  title,
  description,
  actions,
  onDismiss,
}: ActionSheetDialogProps) {
  // 打开时锁定 body 滚动
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC 键关闭
  useEffect(() => {
    if (!open || !onDismiss) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div
      className="orbit-action-sheet-backdrop"
      onClick={onDismiss}
      aria-hidden="true"
    >
      <div
        className="orbit-action-sheet"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="orbit-action-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部：标题 + 描述 */}
        <div className="orbit-action-sheet-header">
          <p id="orbit-action-sheet-title" className="orbit-action-sheet-title">
            {title}
          </p>
          {description && (
            <p className="orbit-action-sheet-description">{description}</p>
          )}
        </div>

        {/* 操作按钮列表 */}
        <div className="orbit-action-sheet-actions">
          {actions.map((action, i) => (
            <button
              key={i}
              type="button"
              className={[
                "orbit-action-sheet-btn",
                action.variant === "destructive"
                  ? "orbit-action-sheet-btn--destructive"
                  : action.variant === "muted"
                  ? "orbit-action-sheet-btn--muted"
                  : "",
                action.bold ? "orbit-action-sheet-btn--bold" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={action.onClick}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
