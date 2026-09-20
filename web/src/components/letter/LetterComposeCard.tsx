import { Link } from "react-router-dom";

export interface LetterComposeCardProps {
  className?: string;
}

export function LetterComposeCard({ className = "" }: LetterComposeCardProps) {
  return (
    <Link
      to="/letter/new"
      className={`orbit-env orbit-env--compose group block select-none cursor-pointer ${className}`}
      aria-label="写一封信"
    >
      <div className="orbit-env-head">
        <div className="orbit-env-badge">
          <span className="w-5 h-5 rounded-full bg-[var(--color-surface-raised)] border border-[var(--color-border-light)] flex items-center justify-center text-xs text-[var(--color-text-secondary)] group-hover:text-[var(--color-accent)] transition-colors">
            ＋
          </span>
          <span className="orbit-env-author text-[var(--color-text-secondary)]">信笺</span>
        </div>
        <span className="orbit-entry-date shrink-0">Orbit</span>
      </div>

      <div className="orbit-env-main">
        <h3 className="orbit-env-title group-hover:text-[var(--color-accent)] transition-colors">
          写一封信…
        </h3>
      </div>

      <span className="orbit-env-sign text-[var(--color-accent)] group-hover:underline">
        开始写信 →
      </span>
    </Link>
  );
}

