import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchEntries,
  TYPE_LABEL,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  type EntrySummary,
} from "../lib/api";
import {
  buildLetterTree,
  entryDisplayLabel,
  formatReplySummary,
  threadParticipants,
  type LetterThread,
} from "../lib/letterThread";
import { useToast } from "../lib/useToast";
import { ChevronRightIcon } from "../components/OrbitIcons";

function EntryRow({
  entry,
  type,
  variant = "root",
}: {
  entry: EntrySummary;
  type: string;
  variant?: "root" | "reply";
}) {
  const showAuthor = Boolean(entry.author);
  const displayText = entryDisplayLabel(entry);

  return (
    <Link
      to={`/${type}/${entry.id}`}
      className={
        variant === "reply"
          ? "orbit-entry-card orbit-entry-card--reply"
          : "orbit-entry-card"
      }
    >
      <span className="orbit-entry-card-main">
        {variant === "reply" && (
          <span className="orbit-letter-reply-badge">回信</span>
        )}
        {displayText && (
          <span className="orbit-entry-title orbit-entry-title-truncate">
            {displayText}
          </span>
        )}
        {showAuthor && entry.author && (
          <span className="orbit-entry-author">{entry.author}</span>
        )}
      </span>
      {entry.entryDate && (
        <span className="orbit-entry-date shrink-0">
          {formatDate(entry.entryDate)}
        </span>
      )}
    </Link>
  );
}

function LetterThreadItem({ thread }: { thread: LetterThread }) {
  const { root, replies } = thread;
  const [expanded, setExpanded] = useState(false);
  const participants = threadParticipants(root, replies);
  const hasReplies = replies.length > 0;

  return (
    <article className="orbit-letter-thread">
      <EntryRow entry={root} type="letter" variant="root" />

      {hasReplies && (
        <>
          <button
            type="button"
            className="orbit-letter-thread-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronRightIcon
              className={`orbit-letter-thread-chevron${expanded ? " orbit-letter-thread-chevron--open" : ""}`}
            />
            <span className="orbit-letter-thread-toggle-text">
              {expanded ? "收起回信" : formatReplySummary(replies)}
            </span>
          </button>

          {expanded && (
            <ul className="orbit-list-plain orbit-letter-replies">
              {replies.map((reply) => (
                <li key={reply.id}>
                  <EntryRow entry={reply} type="letter" variant="reply" />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {hasReplies && participants.length > 0 && (
        <p className="orbit-letter-thread-participants">
          {participants.join(" · ")}
          {!expanded && (
            <span className="orbit-letter-thread-participants-hint">
              {" "}
              · 点击展开回信
            </span>
          )}
        </p>
      )}
    </article>
  );
}

export function ArticleList() {
  const { type } = useParams<{ type: string }>();
  const toast = useToast();
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [prevType, setPrevType] = useState(type);

  if (type !== prevType) {
    setPrevType(type);
    setLoading(true);
    setEntries([]);
  }

  useEffect(() => {
    if (!type) return;
    let cancelled = false;
    fetchEntries(type, type === "letter" ? { roots: false } : undefined)
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((err) => {
        if (!cancelled) {
          if (shouldToastApiError(err)) {
            toast.error(getApiErrorMessage(err, "加载失败，请稍后重试"));
          }
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, toast]);

  const label = TYPE_LABEL[type || ""] || type;
  const letterTree = useMemo(
    () => (type === "letter" ? buildLetterTree(entries) : []),
    [type, entries]
  );

  return (
    <div className="orbit-content">
      <div className="flex items-center justify-between mb-6">
        <h2 className="orbit-page-title">{label}</h2>
        <Link to={`/${type}/new`} className="orbit-btn orbit-btn-primary">
          新建
        </Link>
      </div>

      {loading ? (
        <p className="orbit-muted">加载中…</p>
      ) : entries.length === 0 ? (
        <div className="orbit-muted">
          <p>还没有内容。</p>
          <p>
            <Link to={`/${type}/new`} className="orbit-text-link">
              写下第一篇
            </Link>
            ，记录这一刻。
          </p>
        </div>
      ) : type === "letter" ? (
        <ul className="orbit-list-plain orbit-letter-thread-list">
          {letterTree.map((thread) => (
            <li key={thread.root.id}>
              <LetterThreadItem thread={thread} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="orbit-list-plain orbit-entry-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <EntryRow entry={entry} type={type || "diary"} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
