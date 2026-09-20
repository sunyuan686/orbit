import React from "react";

export interface FilterPillProps {
  label: string;
  icon?: React.ReactNode;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}

export function FilterPill({
  label,
  icon,
  count,
  isActive,
  onClick,
}: FilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-sans transition-all duration-150 cursor-pointer select-none border",
        isActive
          ? "bg-[var(--color-text-primary)] text-[var(--color-surface)] border-[var(--color-text-primary)] font-medium shadow-xs"
          : "bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-secondary)]",
      ].join(" ")}
    >
      {icon && <span className="flex items-center justify-center -ml-0.5">{icon}</span>}
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={[
            "font-mono text-[10px] px-1 rounded-full",
            isActive ? "bg-white/20 text-white" : "bg-[var(--color-border)] text-[var(--color-text-muted)]",
          ].join(" ")}
        >
          {count}
        </span>
      )}
    </button>
  );
}
