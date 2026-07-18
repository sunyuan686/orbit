import { useEffect, useRef } from "react";
import {
  CheckIcon,
  PanelFloatingIcon,
  PanelFullscreenIcon,
  PanelSidebarIcon,
} from "./OrbitIcons";

export type AiPanelLayout = "sidebar" | "floating" | "fullscreen";

const LAYOUT_OPTIONS: {
  id: AiPanelLayout;
  label: string;
  Icon: typeof PanelSidebarIcon;
  dividerBefore?: boolean;
}[] = [
  { id: "sidebar", label: "侧边栏", Icon: PanelSidebarIcon },
  { id: "floating", label: "悬浮", Icon: PanelFloatingIcon },
  { id: "fullscreen", label: "全屏", Icon: PanelFullscreenIcon, dividerBefore: true },
];

interface AiLayoutMenuProps {
  layout: AiPanelLayout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (layout: AiPanelLayout) => void;
}

export function AiLayoutMenu({
  layout,
  open,
  onOpenChange,
  onSelect,
}: AiLayoutMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const TriggerIcon =
    LAYOUT_OPTIONS.find((option) => option.id === layout)?.Icon ?? PanelSidebarIcon;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, onOpenChange]);

  return (
    <div className="orbit-ai-layout-menu" ref={rootRef}>
      <button
        type="button"
        className={`orbit-icon-btn inline-flex${open ? " orbit-icon-btn--active" : ""}`}
        aria-label="切换面板布局"
        aria-expanded={open}
        title="切换布局"
        onClick={() => onOpenChange(!open)}
      >
        <TriggerIcon size="sm" />
      </button>
      {open ? (
        <div className="orbit-ai-layout-menu-popover" role="menu">
          {LAYOUT_OPTIONS.map(({ id, label, Icon, dividerBefore }) => (
            <div key={id} className="orbit-ai-layout-menu-entry">
              {dividerBefore ? <div className="orbit-ai-layout-menu-divider" /> : null}
              <button
                type="button"
                role="menuitemradio"
                aria-checked={layout === id}
                className="orbit-ai-layout-menu-item"
                onClick={() => {
                  onSelect(id);
                  onOpenChange(false);
                }}
              >
                <span className="orbit-ai-layout-menu-item-icon" aria-hidden="true">
                  <Icon size="sm" />
                </span>
                <span className="orbit-ai-layout-menu-item-label">{label}</span>
                <span className="orbit-ai-layout-menu-item-check" aria-hidden="true">
                  {layout === id ? <CheckIcon size="sm" /> : null}
                </span>
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
