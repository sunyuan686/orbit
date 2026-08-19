import type React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  raised?: boolean;
}

export function Card({
  raised = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={`orbit-ui-card${raised ? " orbit-ui-card--raised" : ""} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`orbit-ui-card-header ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardBody({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`orbit-ui-card-body ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`orbit-ui-card-footer ${className}`} {...props}>
      {children}
    </div>
  );
}
