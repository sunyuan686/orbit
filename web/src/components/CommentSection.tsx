import { useMemo, useState } from "react";
import type { CommentItem } from "../lib/api";
import { formatDate } from "../lib/api";
import { CommentComposer } from "./CommentComposer";

function formatCommentTime(ts: number): string {
  const date = formatDate(ts);
  const d = new Date(ts * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${date} ${hh}:${mm}`;
}

function CommentRow({
  comment,
  replies,
  currentAuthor,
  onReply,
  onDelete,
}: {
  comment: CommentItem;
  replies?: CommentItem[];
  currentAuthor?: string | null;
  onReply?: (parentId: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const canDelete = !!comment.author && comment.author === currentAuthor;

  return (
    <article className="orbit-comment-item">
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
        {canDelete && (
          <button type="button" onClick={() => void onDelete(comment.id)}>
            删除
          </button>
        )}
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
              currentAuthor={currentAuthor}
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
  currentAuthor,
  onCreateBottom,
  onReplyBottom,
  onDelete,
}: {
  comments: CommentItem[];
  currentAuthor?: string | null;
  onCreateBottom: (body: string) => Promise<void>;
  onReplyBottom: (parentId: string, body: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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
                currentAuthor={currentAuthor}
                onReply={onReplyBottom}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <p className="orbit-comments-empty">还没有评论。</p>
        )}
      </div>
    </section>
  );
}
