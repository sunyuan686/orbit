import { useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { deleteEntry, formatDate, TYPE_LABEL, type EntrySummary } from "../lib/api";
import { useDrafts } from "../lib/useDrafts";
import { queryKeys } from "../lib/queryKeys";
import { DraftBoxIcon } from "./OrbitIcons";

export interface DraftDrawerProps {
  open: boolean;
  onClose: () => void;
  type: string;
}

function formatDraftTime(ts?: number): string {
  if (!ts) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return formatDate(ts);
}

export function DraftDrawer({ open, onClose, type }: DraftDrawerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: currentEntryId } = useParams<{ id?: string }>();
  const { drafts, isLoading: loading, invalidate } = useDrafts(type);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleOpen = useCallback((draft: EntrySummary) => {
    navigate(`/${draft.type}/${draft.id}/edit`);
    onClose();
  }, [navigate, onClose]);

  const handleDelete = useCallback(async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeleting(id);
    try {
      await deleteEntry(id);
      await Promise.all([
        invalidate(),
        queryClient.invalidateQueries({ queryKey: queryKeys.entry(id) }),
        queryClient.removeQueries({ queryKey: queryKeys.entry(id) }),
      ]);
      setConfirmDeleteId(null);
      if (id === currentEntryId) {
        navigate(`/${type}/new/edit`, { replace: true });
      }
    } catch {
      // 删除失败静默
    } finally {
      setDeleting(null);
    }
  }, [confirmDeleteId, invalidate, queryClient, currentEntryId, navigate, type]);

  if (!open) return null;

  const typeName = TYPE_LABEL[type] ?? type;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="orbit-draft-drawer-overlay"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 抽屉面板 */}
      <div
        className="orbit-draft-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="草稿箱"
      >
        <div className="orbit-draft-drawer-header">
          <div className="orbit-draft-drawer-title">
            <DraftBoxIcon size="sm" />
            <span>草稿箱</span>
            {drafts.length > 0 && (
              <span className="orbit-draft-badge">{drafts.length}</span>
            )}
          </div>
          <button
            type="button"
            className="orbit-draft-drawer-close"
            onClick={onClose}
            aria-label="关闭草稿箱"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="orbit-draft-drawer-body">
          {loading ? (
            <div className="orbit-draft-empty">
              <p className="orbit-muted">加载中…</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="orbit-draft-empty">
              <DraftBoxIcon size="md" />
              <p>还没有{typeName}草稿</p>
              <p className="orbit-draft-empty-hint">编辑时点击「存草稿」保存进度</p>
            </div>
          ) : (
            <ul className="orbit-draft-list" role="list">
              {drafts.map((draft) => {
                const preview = draft.title || draft.snippet || "（空内容）";
                const isConfirming = confirmDeleteId === draft.id;
                const isDeletingThis = deleting === draft.id;
                return (
                  <li key={draft.id} className="orbit-draft-item">
                    <button
                      type="button"
                      className="orbit-draft-item-restore"
                      onClick={() => handleOpen(draft)}
                    >
                      <div className="orbit-draft-item-preview">
                        {preview.slice(0, 80)}
                      </div>
                      <div className="orbit-draft-item-meta">
                        <span className="orbit-draft-item-tag orbit-draft-item-tag--new">草稿</span>
                        <span className="orbit-draft-item-time">
                          {formatDraftTime(draft.updatedAt)}
                        </span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`orbit-draft-item-delete ${isConfirming ? "confirming" : ""}`}
                      onClick={() => void handleDelete(draft.id)}
                      disabled={isDeletingThis}
                      title={isConfirming ? "再次点击确认删除" : "删除草稿"}
                      aria-label={isConfirming ? "确认删除" : "删除草稿"}
                    >
                      {isDeletingThis ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="orbit-spin">
                          <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="8" />
                        </svg>
                      ) : isConfirming ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
