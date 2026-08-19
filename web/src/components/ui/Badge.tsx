import type React from "react";

export type BadgeVariant = "default" | "active" | "accent" | "danger" | "warning";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  mono?: boolean;
  interactive?: boolean;
}

export function Badge({
  variant = "default",
  mono = false,
  interactive = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const classList = [
    "orbit-ui-badge",
    `orbit-ui-badge--${variant}`,
    mono ? "orbit-ui-badge--mono" : "",
    interactive ? "orbit-ui-badge--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classList} {...props}>
      {children}
    </span>
  );
}
