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
    if (docked) {
      // Tap 1 on mobile / PWA: pop out full floating ball from wall (do NOT open panel yet)
      setDocked(false);
      resetIdleDockTimer();
    } else {
      // Tap 2: open AI chat panel!
      onClick();
    }
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
