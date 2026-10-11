import { useState, useRef, useEffect } from "react";

export interface FilterOption<T> {
  value: T;
  label: string;
}

export interface FilterChipDropdownProps<T extends string | number> {
  label: string;
  value: T | null;
  options: FilterOption<T>[];
  onChange: (value: T | null) => void;
  allLabel?: string;
  variant?: "default" | "inline";
  footerAction?: {
    label: string;
    onClick: () => void;
  };
}

export function FilterChipDropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  allLabel = "全部",
  variant = "default",
  footerAction,
}: FilterChipDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (popoverRef.current) {
      setIsScrollable(popoverRef.current.scrollHeight > popoverRef.current.clientHeight);
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleScroll = (e: Event) => {
      if (popoverRef.current && popoverRef.current.contains(e.target as Node)) {
        return;
      }
      setOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [open, options]);

  const activeOption = options.find((o) => o.value === value);
  const hasFilter = value !== null;
  const isInline = variant === "inline";

  return (
    <div
      ref={containerRef}
      className={`orbit-filter-chip-wrap ${isInline ? "orbit-filter-chip-wrap--inline" : ""}`.trim()}
    >
      <button
        type="button"
        className={`orbit-filter-chip ${isInline ? "orbit-filter-chip--inline" : ""}${hasFilter ? " is-active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{hasFilter ? activeOption?.label ?? String(value) : label}</span>
        {hasFilter ? (
          <span
            className="orbit-filter-chip-clear"
            role="button"
            title="清除筛选"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
          >
            ×
          </span>
        ) : (
          <span className="orbit-filter-chip-arrow" aria-hidden>
            ▾
          </span>
        )}
      </button>

      {open && (
        <div
          ref={popoverRef}
          className={`orbit-filter-popover ${isScrollable ? "is-scrollable" : ""}`.trim()}
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className={`orbit-filter-menu-item${value === null ? " is-active" : ""}`}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span>{allLabel}</span>
            {value === null && <span className="orbit-filter-check">✓</span>}
          </button>
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="menuitem"
              className={`orbit-filter-menu-item${value === opt.value ? " is-active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {value === opt.value && <span className="orbit-filter-check">✓</span>}
            </button>
          ))}
          {footerAction && (
            <>
              <div className="my-1 border-t border-[var(--color-border-light)]" />
              <button
                type="button"
                role="menuitem"
                className="orbit-filter-menu-item text-xs text-[var(--color-text-muted)] hover:text-[var(--color-primary)] cursor-pointer"
                onClick={() => {
                  setOpen(false);
                  footerAction.onClick();
                }}
              >
                <span>{footerAction.label}</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
