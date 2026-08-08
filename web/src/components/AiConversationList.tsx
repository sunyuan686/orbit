import { useMemo, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { AiConversationListItem } from "../lib/api";
import { ShareIcon, TrashIcon, MessageIcon } from "./OrbitIcons";

const LONG_PRESS_MS = 480;
const MOVE_THRESHOLD_PX = 10;

function secondaryPreview(title: string, preview: string): string | null {
  const t = title.trim();
  const p = preview.trim();
  if (!p) return null;
  if (!t) return p;
  if (p === t) return null;
  if (!p.startsWith(t)) return p;
  const rest = p.slice(t.length).replace(/^[\s，。！？、.…—\-—.!?,:：]+/u, "");
  return rest || null;
}

function formatRelativeTime(updatedAt?: number | string): string {
  if (!updatedAt) return "";
  const date = typeof updatedAt === "number" ? new Date(updatedAt) : new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

interface AiConversationListProps {
  items: AiConversationListItem[];
  loading: boolean;
  activeId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function AiConversationList({
  items,
  loading,
  activeId,
  onSelect,
  onDelete,
}: AiConversationListProps) {
  const [actionsId, setActionsId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  function clearLongPressTimer() {
    if (longPressTimerRef.current == null) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  }

  useEffect(() => () => clearLongPressTimer(), []);

  useEffect(() => {
    if (!actionsId) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Element | null;
      if (!target?.closest(`[data-conversation-id="${actionsId}"]`)) {
        setActionsId(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [actionsId]);

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>,
    id: string,
    isOwner: boolean
  ) {
    if (!isOwner || event.pointerType === "mouse") return;
    suppressClickRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      suppressClickRef.current = true;
      setActionsId(id);
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(12);
      }
    }, LONG_PRESS_MS);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!pointerStartRef.current || longPressTimerRef.current == null) return;
    const dx = event.clientX - pointerStartRef.current.x;
    const dy = event.clientY - pointerStartRef.current.y;
    if (Math.hypot(dx, dy) > MOVE_THRESHOLD_PX) {
      clearLongPressTimer();
      pointerStartRef.current = null;
    }
  }

  function handlePointerEnd() {
    clearLongPressTimer();
    pointerStartRef.current = null;
  }

  function handleSelect(id: string) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setActionsId(null);
    onSelect(id);
  }

  const timeGroups = useMemo(() => {
    const todayItems: AiConversationListItem[] = [];
    const earlierItems: AiConversationListItem[] = [];

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    items.forEach((item) => {
      const t = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      if (t >= todayStart) {
        todayItems.push(item);
      } else {
        earlierItems.push(item);
      }
    });

    const groups = [];
    if (todayItems.length > 0) {
      groups.push({ title: "Today 今天", items: todayItems });
    }
    if (earlierItems.length > 0) {
      groups.push({ title: "Earlier 更早", items: earlierItems });
    }
    if (groups.length === 0 && items.length > 0) {
      groups.push({ title: "Recently 最近", items });
    }

    return groups;
  }, [items]);

  return (
    <div className="orbit-ai-conversation-list">
      <div className="orbit-ai-conversation-list-header">
        <span className="orbit-ai-conversation-list-title">历史聊天记录</span>
      </div>

      {loading ? <p className="orbit-muted orbit-ai-conversation-status">加载中…</p> : null}

      {!loading && items.length === 0 ? (
        <p className="orbit-muted orbit-ai-conversation-status">还没有历史聊天记录</p>
      ) : null}

      <div className="orbit-ai-conversation-groups">
        {timeGroups.map((group) => (
          <div key={group.title} className="orbit-ai-conversation-group">
            <div className="orbit-ai-conversation-group-title">{group.title}</div>
            <ul className="orbit-ai-conversation-items">
              {group.items.map((item) => {
                const showActions = actionsId === item.id;
                const preview = secondaryPreview(item.title, item.preview);
                const timeText = formatRelativeTime(item.updatedAt);
                return (
                  <li
                    key={item.id}
                    data-conversation-id={item.id}
                    className={[
                      item.isOwner ? "orbit-ai-conversation-row--deletable" : null,
                      showActions ? "orbit-ai-conversation-row--actions" : null,
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined}
                  >
                    <button
                      type="button"
                      className={`orbit-ai-conversation-item${activeId === item.id ? " orbit-ai-conversation-item--active" : ""}`}
                      onClick={() => handleSelect(item.id)}
                      onPointerDown={(event) => handlePointerDown(event, item.id, item.isOwner)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerEnd}
                      onPointerCancel={handlePointerEnd}
                      onContextMenu={(event) => {
                        if (item.isOwner) event.preventDefault();
                      }}
                    >
                      <div className="orbit-ai-conversation-item-header">
                        <span className="orbit-ai-conversation-item-icon" aria-hidden="true">
                          <MessageIcon size="sm" />
                        </span>
                        <span className="orbit-ai-conversation-item-title-text">
                          {item.title}
                        </span>
                        {item.isOwner && item.shared ? (
                          <ShareIcon size="sm" className="orbit-ai-conversation-item-shared" />
                        ) : null}
                        {!item.isOwner ? (
                          <span className="orbit-ai-conversation-item-badge">
                            {item.ownerAuthor} 共享
                          </span>
                        ) : null}
                        {timeText ? (
                          <span className="orbit-ai-conversation-item-time">{timeText}</span>
                        ) : null}
                      </div>

                      {preview ? (
                        <div className="orbit-ai-conversation-item-preview">{preview}</div>
                      ) : null}
                    </button>

                    {item.isOwner ? (
                      <button
                        type="button"
                        className="orbit-icon-btn inline-flex orbit-ai-conversation-delete"
                        aria-label="删除对话"
                        title="删除对话"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionsId(null);
                          onDelete(item.id);
                        }}
                      >
                        <TrashIcon size="sm" />
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
