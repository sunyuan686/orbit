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
import {
  BellIcon,
  CloseIcon,
  DiaryIcon,
  LetterIcon,
  MessageIcon,
} from "./OrbitIcons";
import { usePwaInstall } from "../hooks/usePwaInstall";

const PWA_BELL_TIP_KEY = "orbit_pwa_bell_tip_dismissed";
const PWA_BELL_TIP_DAYS = 14;

function isPwaTipDismissed(): boolean {
  try {
    const raw = localStorage.getItem(PWA_BELL_TIP_KEY);
    if (!raw) return false;
    const time = Number(raw);
    return Date.now() - time < PWA_BELL_TIP_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function markPwaTipDismissed(): void {
  try {
    localStorage.setItem(PWA_BELL_TIP_KEY, Date.now().toString());
  } catch {
    // ignore
  }
}

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor(Date.now() / 1000) - timestamp;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

function cleanNotificationText(raw: string): string {
  if (!raw) return "";
  let text = raw.replace(/<[^>]*>/g, " ");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return text.replace(/\s+/g, " ").trim();
}

function NotificationTypeIcon({
  type,
  targetType,
}: {
  type: string;
  targetType: string;
}) {
  if (type === "letter" || targetType === "letter") {
    return <LetterIcon size="sm" />;
  }
  if (type === "comment" || targetType === "comment") {
    return <MessageIcon size="sm" />;
  }
  return <DiaryIcon size="sm" />;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const { isStandalone, canPrompt, setGuideOpen, triggerInstall } = usePwaInstall();
  const [tipDismissed, setTipDismissed] = useState(isPwaTipDismissed);

  // Touch gesture state for mobile bottom sheet swipe down
  const touchStartY = useRef<number | null>(null);

  const showPwaTip = !isStandalone && !tipDismissed;

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
    function handleClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Lock body scroll on mobile when open
  useEffect(() => {
    if (!open) return;
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
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

  function handleTouchStart(e: React.TouchEvent) {
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartY.current === null) return;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    if (deltaY > 60) {
      setOpen(false);
    }
    touchStartY.current = null;
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
        <>
          {/* Mobile backdrop */}
          <div
            className="orbit-notification-backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            className="orbit-notification-panel"
            role="dialog"
            aria-label="通知列表"
          >
            {/* Mobile drag handle bar */}
            <div
              className="orbit-notification-handle-container"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="orbit-notification-handle" aria-hidden="true" />
            </div>

            <div
              className="orbit-notification-panel-header"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <div className="flex items-center gap-2">
                <span className="orbit-notification-panel-title">通知</span>
                {unread > 0 ? (
                  <span className="orbit-notification-unread-pill">
                    {unread} 未读
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {unread > 0 ? (
                  <button
                    type="button"
                    className="orbit-btn orbit-btn-sm"
                    onClick={() =>
                      void markAllNotificationsRead().then(() =>
                        refreshNotifications()
                      )
                    }
                  >
                    全部已读
                  </button>
                ) : null}
                <button
                  type="button"
                  className="orbit-icon-btn md:hidden p-1 cursor-pointer"
                  aria-label="关闭通知面板"
                  onClick={() => setOpen(false)}
                >
                  <CloseIcon size="sm" />
                </button>
              </div>
            </div>

            <div className="orbit-notification-panel-body">
              {loading ? (
                <p className="orbit-muted orbit-notification-empty">加载中…</p>
              ) : items.length === 0 ? (
                <p className="orbit-muted orbit-notification-empty">暂无通知</p>
              ) : (
                <ul className="orbit-notification-list">
                  {items.map((item) => {
                    const cleanBody = cleanNotificationText(item.body);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`orbit-notification-item${item.readAt ? "" : " orbit-notification-item--unread"}`}
                          onClick={() => void handleOpenItem(item)}
                        >
                          <div className="orbit-notification-item-lead">
                            <div className="orbit-notification-icon-wrapper">
                              <NotificationTypeIcon
                                type={item.type}
                                targetType={item.targetType}
                              />
                            </div>
                            {!item.readAt ? (
                              <span
                                className="orbit-notification-unread-dot"
                                aria-label="未读"
                              />
                            ) : null}
                          </div>
                          <div className="orbit-notification-item-content">
                            <div className="orbit-notification-item-header">
                              <span className="orbit-notification-item-title">
                                {item.title}
                              </span>
                              <span className="orbit-notification-item-meta">
                                {formatRelativeTime(
                                  item.updatedAt || item.createdAt
                                )}
                              </span>
                            </div>
                            {cleanBody ? (
                              <span className="orbit-notification-item-body">
                                {cleanBody}
                              </span>
                            ) : null}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {showPwaTip ? (
              <div className="orbit-notification-panel-footer">
                <span className="orbit-notification-footer-text">
                  添加到主屏幕，不错过锁屏通知
                </span>
                <div className="orbit-notification-footer-actions">
                  <button
                    type="button"
                    className="orbit-notification-footer-action"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      if (canPrompt) {
                        void triggerInstall();
                      } else {
                        setGuideOpen(true);
                      }
                    }}
                  >
                    去添加
                  </button>
                  <button
                    type="button"
                    className="orbit-notification-footer-dismiss"
                    aria-label="不再提示"
                    title="14天内不再提示"
                    onClick={(e) => {
                      e.stopPropagation();
                      markPwaTipDismissed();
                      setTipDismissed(true);
                    }}
                  >
                    <CloseIcon size="sm" />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
