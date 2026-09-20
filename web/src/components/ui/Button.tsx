import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonShape = "rounded" | "pill";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  shape?: ButtonShape;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      shape = "rounded",
      loading = false,
      icon,
      iconRight,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const hasChildren =
      children !== undefined &&
      children !== null &&
      children !== false &&
      children !== "";
    const isIconOnly = !hasChildren && (Boolean(icon) || Boolean(iconRight));

    const classList = [
      "orbit-ui-btn",
      `orbit-ui-btn--${variant}`,
      `orbit-ui-btn--${size}`,
      shape === "pill" ? "orbit-ui-btn--pill" : "",
      isIconOnly ? "orbit-ui-btn--icon-only" : "",
      fullWidth ? "orbit-ui-btn--full" : "",
      loading ? "orbit-ui-btn--loading" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={classList}
        {...props}
      >
        {loading ? (
          <span className="orbit-ui-btn-spinner" aria-hidden="true" />
        ) : icon ? (
          <span className="orbit-ui-btn-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        {hasChildren && (
          <span className="orbit-ui-btn-label">{children}</span>
        )}
        {!loading && iconRight ? (
          <span className="orbit-ui-btn-icon orbit-ui-btn-icon--right" aria-hidden="true">
            {iconRight}
          </span>
        ) : null}
      </button>
    );
  }
);

Button.displayName = "Button";
