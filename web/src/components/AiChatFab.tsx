import { useState, useEffect, useRef } from "react";
import { AiIcon } from "./OrbitIcons";

interface AiChatFabProps {
  open: boolean;
  onClick: () => void;
}

export function AiChatFab({ open, onClick }: AiChatFabProps) {
  const [docked, setDocked] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetIdleDockTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      setDocked(true);
    }, 3500);
  };

  useEffect(() => {
    if (open) {
      setDocked(false);
    } else {
      resetIdleDockTimer();
    }
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [open]);

  const handleExpand = () => {
    setDocked(false);
    resetIdleDockTimer();
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick();
  };

  return (
    <button
      type="button"
      className={`orbit-ai-fab${open ? " orbit-ai-fab--hidden" : ""}${
        docked && !open ? " orbit-ai-fab--docked" : " orbit-ai-fab--expanded"
      }`}
      aria-label="Orbit AI"
      aria-expanded={open}
      title="Orbit AI (⌘J)"
      onClick={handleClick}
      onMouseEnter={handleExpand}
      onFocus={handleExpand}
      onMouseLeave={() => {
        if (!open) resetIdleDockTimer();
      }}
    >
      <span className="orbit-ai-fab-icon" aria-hidden="true">
        <AiIcon size="md" />
      </span>
      <span className="orbit-ai-fab-label" aria-hidden="true">
        Orbit AI
      </span>
    </button>
  );
}
