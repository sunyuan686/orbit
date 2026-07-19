import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchEntries,
  TYPE_LABEL,
  formatDate,
  formatDateCn,
  formatDiaryDateParts,
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

/** letter 仍全量拉取以拼线程树；其余类型分页 */
const PAGE_SIZE = 30;

function authorToneKey(entry: EntrySummary): string {
  return entry.userId || entry.author || entry.id;
}

function useAuthorTones(entries: EntrySummary[]): Map<string, "a" | "b"> {
  return useMemo(() => {
    const order: string[] = [];
    for (const entry of entries) {
      const key = authorToneKey(entry);
      if (!order.includes(key)) order.push(key);
    }
    return new Map(
      order.map((key, index) => [key, index % 2 === 0 ? "a" : "b"])
    );
  }, [entries]);
}

function Snippet({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  return <p className={className ?? "orbit-entry-snippet"}>{text}</p>;
}

function CoverImg({
  src,
  className,
}: {
  src?: string | null;
  className?: string;
}) {
  if (!src) return null;
  return (
    <img
      className={className ?? "orbit-entry-cover"}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
    />
  );
}

/** 回信等仍用紧凑行 */
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
      {entry.entryDate != null && (
        <span className="orbit-entry-date shrink-0">
          {formatDate(entry.entryDate)}
        </span>
      )}
    </Link>
  );
}

function MessageCard({
  entry,
  tone,
  tilt,
}: {
  entry: EntrySummary;
  tone: "a" | "b";
  tilt: "a" | "b" | "none";
}) {
  const body = entry.snippet || entry.title || "（无内容）";
  const hasCover = Boolean(entry.coverUrl);
  const className = [
    "orbit-msg-card",
    `orbit-msg-card--${tone}`,
    tilt !== "none" ? `orbit-msg-card--tilt-${tilt}` : "",
    hasCover ? "orbit-msg-card--has-cover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/message/${entry.id}`} className={className}>
      <p className="orbit-msg-card-body">{body}</p>
      <CoverImg src={entry.coverUrl} className="orbit-msg-card-cover" />
      <div className="orbit-msg-card-meta">
        {entry.author && (
          <span className="orbit-msg-card-author">{entry.author}</span>
        )}
        {entry.entryDate != null && (
          <span className="orbit-entry-date">{formatDate(entry.entryDate)}</span>
        )}
      </div>
    </Link>
  );
}

function DiaryCard({ entry }: { entry: EntrySummary }) {
  const hasCover = Boolean(entry.coverUrl);
  const parts =
    entry.entryDate != null ? formatDiaryDateParts(entry.entryDate) : null;

  return (
    <Link
      to={`/diary/${entry.id}`}
      className={`orbit-diary-card${hasCover ? " orbit-diary-card--has-cover" : ""}`}
    >
      <div className="orbit-diary-card-date">
        {parts ? (
          <>
            <span className="orbit-diary-card-day">{parts.day}</span>
            <span className="orbit-diary-card-month">{parts.month}</span>
            <span className="orbit-diary-card-year">{parts.year}</span>
          </>
        ) : (
          <span className="orbit-diary-card-month">—</span>
        )}
      </div>
      {hasCover && (
        <div className="orbit-diary-card-cover-wrap">
          <CoverImg src={entry.coverUrl} className="orbit-diary-card-cover" />
        </div>
      )}
      <div className="orbit-diary-card-body">
        {entry.title && <h3 className="orbit-diary-card-title">{entry.title}</h3>}
        <Snippet text={entry.snippet} />
        {entry.author && (
          <div className="orbit-diary-card-meta">
            <span className="orbit-entry-author">{entry.author}</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function TimelineCard({ entry }: { entry: EntrySummary }) {
  const hasCover = Boolean(entry.coverUrl);

  return (
    <div className="orbit-tl-item">
      <Link
        to={`/timeline/${entry.id}`}
        className={`orbit-tl-card${hasCover ? " orbit-tl-card--has-cover" : ""}`}
      >
        <div className="orbit-tl-card-body">
          {entry.entryDate != null && (
            <div className="orbit-tl-card-date">{formatDate(entry.entryDate)}</div>
          )}
          {entry.title && <h3 className="orbit-tl-card-title">{entry.title}</h3>}
          <Snippet text={entry.snippet} />
        </div>
        <CoverImg src={entry.coverUrl} className="orbit-tl-card-cover" />
      </Link>
    </div>
  );
}

function MemoCard({ entry }: { entry: EntrySummary }) {
  return (
    <Link to={`/memo/${entry.id}`} className="orbit-memo-card">
      {entry.key && <div className="orbit-memo-card-key">{entry.key}</div>}
      <h3 className="orbit-memo-card-title">
        {entry.title || entry.key || "无标题"}
      </h3>
      <Snippet text={entry.snippet} />
      <div className="orbit-memo-card-foot">
        {entry.author && (
          <span className="orbit-entry-author">{entry.author}</span>
        )}
        {entry.entryDate != null && (
          <span className="orbit-memo-card-updated">
            更新于 {formatDate(entry.entryDate)}
          </span>
        )}
      </div>
    </Link>
  );
}

function LetterRootCard({
  entry,
  replyCount,
}: {
  entry: EntrySummary;
  replyCount: number;
}) {
  const hasCover = Boolean(entry.coverUrl);
  const title = entryDisplayLabel(entry);

  return (
    <Link to={`/letter/${entry.id}`} className="orbit-letter-peek">
      <span className="orbit-letter-peek-flap" aria-hidden="true" />
      <div
        className={`orbit-letter-peek-paper${hasCover ? " orbit-letter-peek-paper--has-cover" : ""}`}
      >
        {title ? <h3 className="orbit-letter-peek-title">{title}</h3> : null}
        <Snippet text={entry.snippet} className="orbit-letter-peek-snip" />
        <CoverImg src={entry.coverUrl} className="orbit-letter-peek-cover" />
      </div>
      <div className="orbit-letter-peek-pocket">
        <div className="orbit-letter-peek-foot">
          <span className="orbit-letter-peek-meta">
            {entry.entryDate != null && (
              <span className="orbit-entry-date">{formatDateCn(entry.entryDate)}</span>
            )}
            {replyCount > 0 && (
              <span className="orbit-letter-peek-badge">{replyCount} 封回信</span>
            )}
          </span>
          {entry.author ? (
            <span className="orbit-letter-peek-sign">— {entry.author}</span>
          ) : null}
        </div>
      </div>
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
      <LetterRootCard entry={root} replyCount={replies.length} />

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

function TypedEntryList({
  type,
  entries,
}: {
  type: string;
  entries: EntrySummary[];
}) {
  const tones = useAuthorTones(entries);

  if (type === "message") {
    return (
      <ul className="orbit-list-plain orbit-msg-board">
        {entries.map((entry, index) => (
          <li key={entry.id}>
            <MessageCard
              entry={entry}
              tone={tones.get(authorToneKey(entry)) ?? "a"}
              tilt={index % 2 === 0 ? "a" : "b"}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (type === "diary") {
    return (
      <ul className="orbit-list-plain orbit-diary-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <DiaryCard entry={entry} />
          </li>
        ))}
      </ul>
    );
  }

  if (type === "timeline") {
    return (
      <div className="orbit-tl-wrap">
        {entries.map((entry) => (
          <TimelineCard key={entry.id} entry={entry} />
        ))}
      </div>
    );
  }

  if (type === "memo") {
    return (
      <ul className="orbit-list-plain orbit-memo-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <MemoCard entry={entry} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="orbit-list-plain orbit-entry-list">
      {entries.map((entry) => (
        <li key={entry.id}>
          <EntryRow entry={entry} type={type} />
        </li>
      ))}
    </ul>
  );
}

export function ArticleList() {
  const { type } = useParams<{ type: string }>();
  const toast = useToast();
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [prevType, setPrevType] = useState(type);

  const isLetter = type === "letter";
  const paginated = Boolean(type) && !isLetter;

  if (type !== prevType) {
    setPrevType(type);
    setLoading(true);
    setEntries([]);
    setTotal(0);
  }

  useEffect(() => {
    if (!type) return;
    let cancelled = false;

    const request = isLetter
      ? fetchEntries(type, { roots: false })
      : fetchEntries(type, { limit: PAGE_SIZE, offset: 0 });

    void request
      .then((data) => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          setEntries(data);
          setTotal(data.length);
        } else {
          setEntries(data.items);
          setTotal(data.total);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          if (shouldToastApiError(err)) {
            toast.error(getApiErrorMessage(err, "加载失败，请稍后重试"));
          }
          setEntries([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [type, isLetter, toast]);

  const loadMore = useCallback(async () => {
    if (!type || !paginated) return;
    setLoadingMore(true);
    try {
      const data = await fetchEntries(type, {
        limit: PAGE_SIZE,
        offset: entries.length,
      });
      setEntries((current) => [...current, ...data.items]);
      setTotal(data.total);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载失败，请稍后重试"));
      }
    } finally {
      setLoadingMore(false);
    }
  }, [type, paginated, entries.length, toast]);

  const label = TYPE_LABEL[type || ""] || type;
  const letterTree = useMemo(
    () => (isLetter ? buildLetterTree(entries) : []),
    [isLetter, entries]
  );
  const hasMore = paginated && entries.length < total;

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
      ) : isLetter ? (
        <ul className="orbit-list-plain orbit-letter-thread-list">
          {letterTree.map((thread) => (
            <li key={thread.root.id}>
              <LetterThreadItem thread={thread} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <TypedEntryList type={type || "diary"} entries={entries} />
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="orbit-btn-ghost"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "加载中…" : "加载更多"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
