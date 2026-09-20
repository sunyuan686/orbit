import { MomentIcon, GalleryIcon, PlusIcon } from "../OrbitIcons";

export interface MomentPromptCardProps {
  onClick: () => void;
  className?: string;
}

export function MomentPromptCard({ onClick, className = "" }: MomentPromptCardProps) {
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
      aria-label="快速记录动态"
      className={`w-full bg-[var(--color-surface)] border border-[var(--color-border-light)] hover:border-[var(--color-border)] rounded-xl p-3 sm:p-3.5 flex items-center gap-3 transition-all duration-150 cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_2px_6px_rgba(0,0,0,0.04)] group select-none ${className}`}
    >
      <div className="w-8 h-8 rounded-full bg-[var(--color-surface-raised)] border border-[var(--color-border-light)] flex items-center justify-center text-[var(--color-primary)] group-hover:scale-105 transition-transform shrink-0">
        <MomentIcon size="sm" />
      </div>

      <span className="flex-1 text-sm text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors font-sans truncate">
        记录今天的美好吧…
      </span>

      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors shrink-0">
        <span
          className="p-1.5 rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors"
          title="添加照片或日常"
        >
          <GalleryIcon size="sm" />
        </span>
        <span
          className="p-1.5 rounded-lg bg-[var(--color-surface-raised)] text-[var(--color-text-primary)]"
          title="写动态"
        >
          <PlusIcon size="sm" />
        </span>
      </div>
    </div>
  );
}
