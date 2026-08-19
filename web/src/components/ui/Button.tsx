import React, { forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      loading = false,
      icon,
      fullWidth = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    const classList = [
      "orbit-ui-btn",
      `orbit-ui-btn--${variant}`,
      `orbit-ui-btn--${size}`,
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
        <span className="orbit-ui-btn-label">{children}</span>
      </button>
    );
  }
);

Button.displayName = "Button";
