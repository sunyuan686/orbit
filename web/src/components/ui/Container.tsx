import type { HTMLAttributes, ReactNode } from "react";

export type ContainerSize = "narrow" | "standard" | "wide" | "full";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: ContainerSize;
  children: ReactNode;
}

export function Container({
  size = "standard",
  className = "",
  children,
  ...props
}: ContainerProps) {
  const classList = [
    "orbit-ui-container",
    `orbit-ui-container--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classList} {...props}>
      {children}
    </div>
  );
}
