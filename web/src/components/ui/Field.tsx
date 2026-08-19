import type { HTMLAttributes, ReactNode } from "react";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  stacked?: boolean;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required = false,
  stacked = true,
  className = "",
  children,
  ...props
}: FieldProps) {
  const classList = [
    "orbit-ui-field",
    stacked ? "orbit-ui-field--stacked" : "orbit-ui-field--inline",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classList} {...props}>
      {(label || hint) && (
        <div className="orbit-ui-field-header">
          {label && (
            <div className="orbit-ui-field-label-row">
              <label htmlFor={htmlFor} className="orbit-ui-field-label">
                {label}
                {required && <span className="orbit-ui-field-required" aria-hidden="true">*</span>}
              </label>
            </div>
          )}
          {hint && <p className="orbit-ui-field-hint">{hint}</p>}
        </div>
      )}
      <div className="orbit-ui-field-control">{children}</div>
      {error ? (
        <p className="orbit-ui-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
