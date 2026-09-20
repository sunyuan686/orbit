import type React from "react";
import { CheckIcon, AlertIcon, InfoIcon } from "../OrbitIcons";

export type ToastVariant = "success" | "error" | "info";

export interface ToastProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: ToastVariant;
  visible?: boolean;
  onDismiss?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

const DEFAULT_ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckIcon size="sm" />,
  error: <AlertIcon size="sm" />,
  info: <InfoIcon size="sm" />,
};

/**
 * Orbit 通用轻提示组件 (Toast)
 * 遵循 60-30-10 墨水排版规范：
 * - 纯粹的 [ 单色图标 + 文案 ] 结构，无冗余关闭按钮；
 * - 10px 微圆角纸签质感，中性细边框与柔和浮动阴影；
 * - 支持点击整条快速消退。
 */
export function Toast({
  variant = "info",
  visible = true,
  onDismiss,
  icon,
  className = "",
  children,
  onClick,
  ...props
}: ToastProps) {
  const displayIcon = icon !== undefined ? icon : DEFAULT_ICONS[variant];

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    onClick?.(e);
    onDismiss?.();
  };

  const classList = [
    "orbit-ui-toast",
    `orbit-ui-toast--${variant}`,
    visible ? "orbit-ui-toast--visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classList}
      role="status"
      onClick={handleClick}
      {...props}
    >
      {displayIcon && (
        <span className="orbit-ui-toast-icon" aria-hidden>
          {displayIcon}
        </span>
      )}
      <span className="orbit-ui-toast-message">{children}</span>
    </div>
  );
}

export interface ToastStackProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ToastStack({ className = "", children, ...props }: ToastStackProps) {
  return (
    <div
      className={`orbit-ui-toast-stack ${className}`.trim()}
      aria-live="polite"
      {...props}
    >
      {children}
    </div>
  );
}
