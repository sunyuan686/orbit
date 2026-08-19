import type { HTMLAttributes, ReactNode } from "react";

export type StackGap = "none" | "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
export type StackAlign = "start" | "center" | "end" | "stretch";
export type StackDirection = "column" | "row";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  gap?: StackGap;
  align?: StackAlign;
  direction?: StackDirection;
  wrap?: boolean;
  children: ReactNode;
}

export function Stack({
  gap = "md",
  align = "stretch",
  direction = "column",
  wrap = false,
  className = "",
  children,
  ...props
}: StackProps) {
  const classList = [
    "orbit-ui-stack",
    `orbit-ui-stack--${direction}`,
    `orbit-ui-stack--gap-${gap}`,
    `orbit-ui-stack--align-${align}`,
    wrap ? "orbit-ui-stack--wrap" : "",
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
