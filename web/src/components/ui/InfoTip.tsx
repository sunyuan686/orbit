import {
  useState,
  useRef,
  useEffect,
  useId,
  type ReactNode,
  type HTMLAttributes,
} from "react";
import { InfoIcon } from "../OrbitIcons";

export interface InfoTipProps extends Omit<HTMLAttributes<HTMLDivElement>, "content"> {
  content: ReactNode;
  placement?: "top" | "bottom";
  ariaLabel?: string;
}

export function InfoTip({
  content,
  placement = "top",
  ariaLabel = "查看说明",
  className = "",
  ...props
}: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const tooltipId = useId();

  const clearHoverTimer = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setIsOpen(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  const toggleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearHoverTimer();
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => clearHoverTimer();
  }, []);

  return (
    <div
      className={`orbit-ui-infotip ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      <button
        ref={triggerRef}
        type="button"
        className="orbit-ui-infotip-trigger"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-describedby={isOpen ? tooltipId : undefined}
        onClick={toggleOpen}
      >
        <InfoIcon size="sm" />
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          id={tooltipId}
          role="tooltip"
          className={`orbit-ui-infotip-popover orbit-ui-infotip-popover--${placement}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="orbit-ui-infotip-content">{content}</div>
        </div>
      )}
    </div>
  );
}
