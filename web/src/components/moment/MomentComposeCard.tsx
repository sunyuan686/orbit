import { SparklesIcon } from "../OrbitIcons";

export interface MomentComposeCardProps {
  onClick: () => void;
  layout?: "feed" | "list";
  className?: string;
}

export function MomentComposeCard({
  onClick,
  layout = "feed",
  className = "",
}: MomentComposeCardProps) {
  if (layout === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={`group flex items-center justify-between p-4 sm:p-5 rounded-xl bg-[var(--color-surface)] border border-dashed border-[var(--color-border)] hover:border-[var(--color-accent)] shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer select-none text-inherit ${className}`}
        aria-label="记录动态"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-5 h-5 rounded-full bg-[var(--color-surface-raised)] border border-[var(--color-border-light)] flex items-center justify-center text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] group-hover:border-[var(--color-accent)]/50 transition-colors shrink-0">
            ＋
          </span>
          <span className="text-sm font-medium text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors truncate">
            记录此刻的思绪…
          </span>
        </div>
        <SparklesIcon size="sm" className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:scale-105 transition-all shrink-0" />
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`group flex flex-col justify-between p-3 sm:p-3.5 rounded-[14px] bg-[var(--color-surface)] border border-dashed border-[var(--color-border-light)] hover:border-[var(--color-accent)]/70 shadow-xs hover:shadow-sm transition-all cursor-pointer select-none text-inherit no-underline min-h-[105px] sm:min-h-[115px] ${className}`}
      aria-label="记录动态"
    >
      <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span className="px-1.5 py-0.5 rounded bg-[var(--color-surface-raised)] font-mono text-[10px]">
          速记
        </span>
        <SparklesIcon size="sm" className="text-[var(--color-text-muted)] group-hover:scale-110 group-hover:text-[var(--color-accent)] transition-all" />
      </div>

      <div className="my-1.5">
        <h3 className="font-heading text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
          记录动态…
        </h3>
      </div>

      <span className="text-[11px] font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] group-hover:underline self-end transition-colors">
        开始记录 →
      </span>
    </div>
  );
}
