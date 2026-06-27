import type { AiConversationListItem } from "../lib/api";

interface AiConversationListProps {
  items: AiConversationListItem[];
  loading: boolean;
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function AiConversationList({
  items,
  loading,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: AiConversationListProps) {
  return (
    <div className="orbit-ai-conversation-list">
      <div className="orbit-ai-conversation-list-header">
        <span className="orbit-ai-conversation-list-title">我的对话</span>
        <button type="button" className="orbit-btn-ghost orbit-btn-sm" onClick={onNew}>
          新对话
        </button>
      </div>

      {loading ? <p className="orbit-muted text-sm px-2">加载中…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="orbit-muted text-sm px-2">还没有对话</p>
      ) : null}

      <ul className="orbit-ai-conversation-items">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={`orbit-ai-conversation-item${activeId === item.id ? " orbit-ai-conversation-item--active" : ""}`}
              onClick={() => onSelect(item.id)}
            >
              <span className="orbit-ai-conversation-item-title">{item.title}</span>
              {!item.isOwner ? (
                <span className="orbit-ai-conversation-item-badge">
                  {item.ownerAuthor} 共享
                </span>
              ) : null}
              {item.preview ? (
                <span className="orbit-ai-conversation-item-preview">{item.preview}</span>
              ) : null}
            </button>
            {item.isOwner ? (
              <button
                type="button"
                className="orbit-btn-ghost orbit-btn-sm orbit-ai-conversation-delete"
                aria-label="删除对话"
                onClick={() => onDelete(item.id)}
              >
                删除
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
