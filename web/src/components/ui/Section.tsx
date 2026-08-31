import type React from "react";
import { InfoTip } from "./InfoTip";

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description?: React.ReactNode;
  info?: React.ReactNode;
}

export function Section({
  title,
  description,
  info,
  className = "",
  children,
  ...props
}: SectionProps) {
  return (
    <section className={`orbit-ui-section ${className}`} {...props}>
      <div className="orbit-ui-section-header">
        <div className="orbit-ui-section-title-row">
          <h3 className="orbit-ui-section-title">{title}</h3>
          {info && <InfoTip content={info} />}
        </div>
        {description && (
          <p className="orbit-ui-section-desc">{description}</p>
        )}
      </div>
      <div className="orbit-ui-section-content">{children}</div>
    </section>
  );
}
