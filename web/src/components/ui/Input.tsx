import React, { forwardRef } from "react";

export type InputSize = "sm" | "md" | "lg";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  sizeVariant?: InputSize;
  mono?: boolean;
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      sizeVariant = "md",
      mono = false,
      error = false,
      className = "",
      type = "text",
      ...props
    },
    ref
  ) => {
    const isMonoType = mono || type === "number" || type === "password";
    const classList = [
      "orbit-ui-input",
      `orbit-ui-input--${sizeVariant}`,
      isMonoType ? "orbit-ui-input--mono" : "",
      error ? "orbit-ui-input--error" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return <input ref={ref} type={type} className={classList} {...props} />;
  }
);

Input.displayName = "Input";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  sizeVariant?: InputSize;
  mono?: boolean;
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      sizeVariant = "md",
      mono = false,
      error = false,
      className = "",
      ...props
    },
    ref
  ) => {
    const classList = [
      "orbit-ui-input",
      "orbit-ui-textarea",
      `orbit-ui-input--${sizeVariant}`,
      mono ? "orbit-ui-input--mono" : "",
      error ? "orbit-ui-input--error" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return <textarea ref={ref} className={classList} {...props} />;
  }
);

Textarea.displayName = "Textarea";
