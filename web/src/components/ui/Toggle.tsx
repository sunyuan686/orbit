export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  ariaLabel,
  className = "",
}: ToggleProps) {
  const switchElement = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel || label}
      disabled={disabled}
      className={`orbit-ui-toggle${checked ? " orbit-ui-toggle--checked" : ""}${disabled ? " orbit-ui-toggle--disabled" : ""}`}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <span className="orbit-ui-toggle-thumb" aria-hidden="true" />
    </button>
  );

  if (label) {
    return (
      <label className={`orbit-ui-toggle-wrapper ${className}`}>
        <span className="orbit-ui-toggle-label">{label}</span>
        {switchElement}
      </label>
    );
  }

  return switchElement;
}
