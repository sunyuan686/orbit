import { useEffect } from "react";
import type { MilestoneUnlock } from "../lib/api";

interface MilestoneCelebrateProps {
  items: MilestoneUnlock[];
  onDone: () => void;
}

export function MilestoneCelebrate({ items, onDone }: MilestoneCelebrateProps) {
  const primary = items[0];
  const extra = items.length - 1;

  useEffect(() => {
    if (!primary) return;
    const timer = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(timer);
  }, [primary, onDone]);

  if (!primary) return null;

  const isConstellation = primary.category === "constellation";

  return (
    <div
      className="orbit-memory-celebrate"
      role="dialog"
      aria-modal="true"
      aria-label={isConstellation ? "星座亮起" : "里程碑亮起"}
      onClick={onDone}
    >
      <div
        className={`orbit-memory-celebrate-card${
          isConstellation ? " orbit-memory-celebrate-card--constellation" : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="orbit-memory-celebrate-eyebrow">
          {isConstellation ? "星座亮起" : "里程碑亮起"}
        </p>
        <div className="orbit-memory-celebrate-burst" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <h2 className="orbit-memory-celebrate-title">{primary.title}</h2>
        <p className="orbit-muted">{primary.description}</p>
        {extra > 0 ? (
          <p className="orbit-memory-celebrate-extra">还有 {extra} 个一起亮了</p>
        ) : null}
        <button type="button" className="orbit-btn orbit-btn-sm" onClick={onDone}>
          真好
        </button>
      </div>
    </div>
  );
}
