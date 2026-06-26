import { useEffect, useMemo, useState } from "react";
import type { CommentItem } from "../lib/api";
import { formatDate } from "../lib/api";
import { useMinWidthXl } from "../lib/useBreakpoint";
import { MARGINALIA_RAIL_STORAGE_KEY, useRailExpanded } from "../lib/railPreferences";
import { MarginaliaIcon, CloseIcon } from "./OrbitIcons";
import { CommentComposer } from "./CommentComposer";

function formatMarginaliaTime(ts: number): string {
  const date = formatDate(ts);
  const d = new Date(ts * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

function sortByAnchor(comments: CommentItem[]): CommentItem[] {
  return [...comments].sort((left, right) => {
    const leftAnchor = left.anchorFrom ?? Number.MAX_SAFE_INTEGER;
    const rightAnchor = right.anchorFrom ?? Number.MAX_SAFE_INTEGER;
    return leftAnchor - rightAnchor;
  });
}

function MarginaliaCard({
  comment,
  active,
  currentAuthor,
  onEdit,
  onDelete,
  onSelect,
}: {
  comment: CommentItem;
  active: boolean;
  currentAuthor?: string | null;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelect: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const canManage = !!comment.author && comment.author === currentAuthor;

  return (
    <article
      id={`marginalia-card-${comment.id}`}
      className={`orbit-marginalia-card${active ? " orbit-marginalia-card--active" : ""}`}
      onClick={() => {
        if (!editing) {
          onSelect(comment.id);
        }
      }}
    >
      {comment.quote && (
        <blockquote className="orbit-comment-quote">{comment.quote}</blockquote>
      )}
      <div className="orbit-comment-meta">
        <span>{comment.author || "匿名"}</span>
        <time>{formatMarginaliaTime(comment.createdAt)}</time>
      </div>
      {editing ? (
        <div
          className="orbit-comment-edit-box"
          onClick={(event) => event.stopPropagation()}
        >
          <CommentComposer
            key={comment.id}
            initialBody={comment.body}
            placeholder="编辑边注..."
            submitLabel="保存"
            clearOnSubmit={false}
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              await onEdit(comment.id, body);
              setEditing(false);
            }}
          />
        </div>
      ) : (
        <p className="orbit-comment-body">{comment.body}</p>
      )}
      {canManage && !editing && (
        <div className="orbit-comment-actions">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setEditing(true);
            }}
          >
            编辑
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void onDelete(comment.id);
            }}
          >
            删除
          </button>
        </div>
      )}
    </article>
  );
}

function MarginaliaPanel({
  inlineComments,
  activeInlineCommentId,
  currentAuthor,
  onEdit,
  onDelete,
  onSelectInline,
}: {
  inlineComments: CommentItem[];
  activeInlineCommentId: string | null;
  currentAuthor?: string | null;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelectInline: (id: string) => void;
}) {
  const sorted = useMemo(() => sortByAnchor(inlineComments), [inlineComments]);

  return (
    <div className="orbit-marginalia-panel">
      {sorted.length > 0 ? (
        <div className="orbit-marginalia-list">
          {sorted.map((comment) => (
            <MarginaliaCard
              key={comment.id}
              comment={comment}
              active={comment.id === activeInlineCommentId}
              currentAuthor={currentAuthor}
              onEdit={onEdit}
              onDelete={onDelete}
              onSelect={onSelectInline}
            />
          ))}
        </div>
      ) : (
        <p className="orbit-comments-empty">还没有边注。</p>
      )}
    </div>
  );
}

type MarginaliaContentProps = {
  inlineComments: CommentItem[];
  activeInlineCommentId: string | null;
  currentAuthor?: string | null;
  onEdit: (id: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelectInline: (id: string) => void;
};

function MarginaliaTriggerButton({
  count,
  ariaLabel,
  className,
  onClick,
  ariaExpanded,
}: {
  count: number;
  ariaLabel: string;
  className?: string;
  onClick: () => void;
  ariaExpanded?: boolean;
}) {
  return (
    <button
      type="button"
      className={`orbit-marginalia-trigger${className ? ` ${className}` : ""}`}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
    >
      <MarginaliaIcon size="md" />
      {count > 0 && <span className="orbit-marginalia-trigger-badge">{count}</span>}
    </button>
  );
}

function MarginaliaMarkers({
  inlineComments,
  onExpand,
}: {
  inlineComments: CommentItem[];
  onExpand: () => void;
}) {
  const count = inlineComments.length;

  return (
    <div className="orbit-marginalia-gutter hidden xl:block shrink-0">
      <MarginaliaTriggerButton
        className="orbit-marginalia-gutter-trigger"
        count={count}
        ariaLabel={count > 0 ? `展开边注，共 ${count} 条` : "写边注"}
        ariaExpanded={false}
        onClick={onExpand}
      />
    </div>
  );
}

export function MarginaliaRail({
  inlineComments,
  activeInlineCommentId,
  currentAuthor,
  onEdit,
  onDelete,
  onSelectInline,
}: MarginaliaContentProps) {
  const [expanded, setExpanded] = useRailExpanded(MARGINALIA_RAIL_STORAGE_KEY, false);
  const count = inlineComments.length;

  useEffect(() => {
    if (activeInlineCommentId) {
      setExpanded(true);
    }
  }, [activeInlineCommentId, setExpanded]);

  useEffect(() => {
    if (!expanded || !activeInlineCommentId) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`marginalia-card-${activeInlineCommentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [expanded, activeInlineCommentId]);

  if (count === 0) {
    return null;
  }

  return (
    <>
      {!expanded && (
        <MarginaliaMarkers
          inlineComments={inlineComments}
          onExpand={() => setExpanded(true)}
        />
      )}

      {expanded && (
        <aside className="orbit-marginalia-rail orbit-marginalia-rail--expanded hidden xl:flex shrink-0">
          <div className="orbit-marginalia-rail-body">
            <div className="orbit-rail-header">
              <h3 className="orbit-rail-header-title">边注</h3>
              <span className="orbit-rail-header-count">{count}</span>
              <button
                type="button"
                className="orbit-rail-collapse"
                onClick={() => setExpanded(false)}
                aria-label="收起边注"
              >
                &raquo;
              </button>
            </div>
            <MarginaliaPanel
              inlineComments={inlineComments}
              activeInlineCommentId={activeInlineCommentId}
              currentAuthor={currentAuthor}
              onEdit={onEdit}
              onDelete={onDelete}
              onSelectInline={onSelectInline}
            />
          </div>
        </aside>
      )}
    </>
  );
}

export function MobileMarginalia({
  open,
  onOpenChange,
  inlineComments,
  activeInlineCommentId,
  currentAuthor,
  onEdit,
  onDelete,
  onSelectInline,
}: MarginaliaContentProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isXlUp = useMinWidthXl();
  const count = inlineComments.length;
  const visible = count > 0;

  useEffect(() => {
    if (!open || !activeInlineCommentId) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`marginalia-card-${activeInlineCommentId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [open, activeInlineCommentId]);

  if (isXlUp || !visible) {
    return null;
  }

  return (
    <>
      <MarginaliaTriggerButton
        className="orbit-marginalia-fab xl:hidden"
        count={count}
        ariaLabel={count > 0 ? `打开边注，共 ${count} 条` : "写边注"}
        onClick={() => onOpenChange(true)}
      />

      {open && (
        <div
          className="orbit-overlay-scrim fixed inset-0 z-40 xl:hidden"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
      )}

      <div className={`orbit-toc-drawer xl:hidden${open ? " orbit-toc-drawer--open" : ""}`}>
        <div className="orbit-toc-drawer-panel">
          <div className="orbit-toc-drawer-header">
            <div className="flex items-center gap-3">
              <div className="orbit-toc-drawer-handle" aria-hidden />
              <span className="orbit-toc-drawer-title">边注 ({count})</span>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="orbit-icon-btn p-1 cursor-pointer"
              aria-label="关闭边注"
            >
              <CloseIcon size="md" />
            </button>
          </div>
          <div className="orbit-toc-drawer-body orbit-marginalia-drawer-body">
            <MarginaliaPanel
              inlineComments={inlineComments}
              activeInlineCommentId={activeInlineCommentId}
              currentAuthor={currentAuthor}
              onEdit={onEdit}
              onDelete={onDelete}
              onSelectInline={onSelectInline}
            />
          </div>
        </div>
      </div>
    </>
  );
}
