import type React from "react";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: string;
}

export function Section({
  title,
  description,
  className = "",
  children,
  ...props
}: SectionProps) {
  return (
    <section className={`orbit-ui-section ${className}`} {...props}>
      <div className="orbit-ui-section-header">
        <h3 className="orbit-ui-section-title">{title}</h3>
        {description && (
          <p className="orbit-ui-section-desc">{description}</p>
        )}
      </div>
      <div className="orbit-ui-section-content">{children}</div>
    </section>
  );
}
