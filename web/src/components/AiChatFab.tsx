import { AiIcon } from "./OrbitIcons";

interface AiChatFabProps {
  open: boolean;
  onClick: () => void;
}

export function AiChatFab({ open, onClick }: AiChatFabProps) {
  return (
    <button
      type="button"
      className={`orbit-ai-fab${open ? " orbit-ai-fab--hidden" : ""}`}
      aria-label="Orbit AI"
      aria-expanded={open}
      title="Orbit AI (⌘J)"
      onClick={onClick}
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
