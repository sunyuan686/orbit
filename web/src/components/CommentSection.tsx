import { useMemo, useState } from "react";
import type { CommentItem } from "../lib/api";
import { formatDate } from "../lib/api";

function formatCommentTime(ts: number): string {
  const date = formatDate(ts);
  const d = new Date(ts * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

function CommentComposer({
  placeholder,
  submitLabel,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const next = body.trim();
    if (!next || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(next);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="orbit-comment-composer">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <div className="orbit-comment-composer-actions">
        <button
          type="button"
          className="orbit-btn orbit-btn-primary"
          disabled={!body.trim() || submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? "发送中" : submitLabel}
        </button>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  replies,
  active,
  onReply,
  onDelete,
  onSelect,
}: {
  comment: CommentItem;
  replies?: CommentItem[];
  active?: boolean;
  onReply?: (parentId: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelect?: (id: string) => void;
}) {
  const [replying, setReplying] = useState(false);

  return (
    <article
      className={`orbit-comment-item${active ? " orbit-comment-item-active" : ""}`}
      onClick={() => onSelect?.(comment.id)}
    >
      {comment.quote && (
        <blockquote className="orbit-comment-quote">{comment.quote}</blockquote>
      )}
      <div className="orbit-comment-meta">
        <span>{comment.author || "匿名"}</span>
        <time>{formatCommentTime(comment.createdAt)}</time>
      </div>
      <p className="orbit-comment-body">{comment.body}</p>
      <div className="orbit-comment-actions">
        {onReply && (
          <button type="button" onClick={() => setReplying((value) => !value)}>
            回复
          </button>
        )}
        <button type="button" onClick={() => void onDelete(comment.id)}>
          删除
        </button>
      </div>
      {replying && onReply && (
        <div className="orbit-comment-reply-box">
          <CommentComposer
            placeholder="写一条回复..."
            submitLabel="回复"
            onSubmit={async (body) => {
              await onReply(comment.id, body);
              setReplying(false);
            }}
          />
        </div>
      )}
      {replies && replies.length > 0 && (
        <div className="orbit-comment-replies">
          {replies.map((reply) => (
            <CommentRow
              key={reply.id}
              comment={reply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </article>
  );
}

export function CommentSection({
  comments,
  inlineComments,
  activeInlineCommentId,
  enableBottom,
  enableInline,
  inlineDraft,
  onCreateBottom,
  onCreateInline,
  onCancelInlineDraft,
  onReplyBottom,
  onDelete,
  onSelectInline,
}: {
  comments: CommentItem[];
  inlineComments: CommentItem[];
  activeInlineCommentId: string | null;
  enableBottom: boolean;
  enableInline: boolean;
  inlineDraft: { quote: string; anchorFrom: number; anchorTo: number } | null;
  onCreateBottom: (body: string) => Promise<void>;
  onCreateInline: (body: string) => Promise<void>;
  onCancelInlineDraft: () => void;
  onReplyBottom: (parentId: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onSelectInline: (id: string) => void;
}) {
  const bottomRoots = useMemo(
    () => comments.filter((comment) => !comment.parentId),
    [comments]
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, CommentItem[]>();
    for (const comment of comments) {
      if (!comment.parentId) continue;
      const items = map.get(comment.parentId) ?? [];
      items.push(comment);
      map.set(comment.parentId, items);
    }
    return map;
  }, [comments]);

  return (
    <section className="orbit-comments">
      {enableInline && (
        <div className="orbit-comments-block">
          <div className="orbit-comments-heading">
            <h3>边注</h3>
            <span>{inlineComments.length}</span>
          </div>
          {inlineDraft && (
            <div className="orbit-inline-draft">
              <blockquote className="orbit-comment-quote">{inlineDraft.quote}</blockquote>
              <CommentComposer
                placeholder="给选中的文字写一条边注..."
                submitLabel="添加边注"
                onSubmit={onCreateInline}
              />
              <button type="button" onClick={onCancelInlineDraft}>
                取消
              </button>
            </div>
          )}
          {inlineComments.length > 0 ? (
            <div className="orbit-comment-list">
              {inlineComments.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  active={comment.id === activeInlineCommentId}
                  onDelete={onDelete}
                  onSelect={onSelectInline}
                />
              ))}
            </div>
          ) : (
            <p className="orbit-comments-empty">还没有边注。</p>
          )}
        </div>
      )}

      {enableBottom && (
        <div className="orbit-comments-block">
          <div className="orbit-comments-heading">
            <h3>评论</h3>
            <span>{comments.length}</span>
          </div>
          <CommentComposer
            placeholder="写一条评论..."
            submitLabel="评论"
            onSubmit={onCreateBottom}
          />
          {bottomRoots.length > 0 ? (
            <div className="orbit-comment-list">
              {bottomRoots.map((comment) => (
                <CommentRow
                  key={comment.id}
                  comment={comment}
                  replies={repliesByParent.get(comment.id)}
                  onReply={onReplyBottom}
                  onDelete={onDelete}
                />
              ))}
            </div>
          ) : (
            <p className="orbit-comments-empty">还没有评论。</p>
          )}
        </div>
      )}
    </section>
  );
}
