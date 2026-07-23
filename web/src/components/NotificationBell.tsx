import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchNotifications,
  fetchNotificationUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../lib/api";
import { BellIcon } from "./OrbitIcons";

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const unreadQuery = useQuery({
    queryKey: ["notifications-unread"] as const,
    queryFn: fetchNotificationUnreadCount,
    refetchInterval: 60_000,
  });

  const listQuery = useQuery({
    queryKey: ["notifications"] as const,
    queryFn: fetchNotifications,
    enabled: open,
  });

  const unread = unreadQuery.data?.count ?? 0;
  const items = listQuery.data ?? [];
  const loading = listQuery.isPending;

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function refreshNotifications() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
      queryClient.invalidateQueries({ queryKey: ["notifications-unread"] }),
    ]);
  }

  async function handleOpenItem(item: NotificationItem) {
    if (!item.readAt) {
      await markNotificationRead(item.id);
      await refreshNotifications();
    }
    setOpen(false);
    const path = item.link.startsWith("http")
      ? new URL(item.link).pathname
      : item.link;
    navigate(path);
  }

  return (
    <div className="orbit-notification-bell" ref={rootRef}>
      <button
        type="button"
        className="orbit-icon-btn inline-flex p-1.5 cursor-pointer relative"
        title="通知"
        aria-label="通知"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <BellIcon />
        {unread > 0 ? (
          <span className="orbit-notification-badge" aria-hidden="true">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="orbit-notification-panel" role="dialog" aria-label="通知列表">
          <div className="orbit-notification-panel-header">
            <span>通知</span>
            {unread > 0 ? (
              <button
                type="button"
                className="orbit-btn orbit-btn-sm"
                onClick={() =>
                  void markAllNotificationsRead().then(() => refreshNotifications())
                }
              >
                全部已读
              </button>
            ) : null}
          </div>
          <div className="orbit-notification-panel-body">
            {loading ? (
              <p className="orbit-muted orbit-notification-empty">加载中…</p>
            ) : items.length === 0 ? (
              <p className="orbit-muted orbit-notification-empty">暂无通知</p>
            ) : (
              <ul className="orbit-notification-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`orbit-notification-item${item.readAt ? "" : " orbit-notification-item--unread"}`}
                      onClick={() => void handleOpenItem(item)}
                    >
                      <span className="orbit-notification-item-title">{item.title}</span>
                      <span className="orbit-notification-item-body">{item.body}</span>
                      <span className="orbit-notification-item-meta">
                        {formatRelativeTime(item.updatedAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
