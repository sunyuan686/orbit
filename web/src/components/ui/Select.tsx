import React, { forwardRef } from "react";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export type SelectSize = "sm" | "md" | "lg";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options?: SelectOption[];
  sizeVariant?: SelectSize;
  mono?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, sizeVariant = "md", mono = false, className = "", children, ...props }, ref) => {
    const classList = [
      "orbit-ui-input",
      "orbit-ui-select",
      `orbit-ui-input--${sizeVariant}`,
      mono ? "orbit-ui-input--mono" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <select ref={ref} className={classList} {...props}>
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    );
  }
);

Select.displayName = "Select";
