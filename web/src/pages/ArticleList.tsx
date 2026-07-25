import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  beijingDateParts,
  fetchEntries,
  TYPE_LABEL,
  formatDate,
  formatDateCn,
  formatDiaryDateParts,
  getApiErrorMessage,
  shouldToastApiError,
  type EntryListPage,
  type EntrySummary,
} from "../lib/api";
import {
  authorSealChar,
  buildLetterTree,
  entryDisplayLabel,
  formatReplySummary,
  type LetterThread,
} from "../lib/letterThread";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../lib/useToast";

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

function EntryRow({ entry, type }: { entry: EntrySummary; type: string }) {
  const showAuthor = Boolean(entry.author);
  const displayText = entryDisplayLabel(entry);

  return (
    <Link to={`/${type}/${entry.id}`} className="orbit-entry-card">
      <span className="orbit-entry-card-main">
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

function PolaroidMessageCard({
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
  const initial = entry.author ? entry.author.charAt(0) : "★";
  const className = [
    "orbit-polaroid-card",
    `orbit-polaroid-card--${tone}`,
    tilt !== "none" ? `orbit-polaroid-card--tilt-${tilt}` : "",
    hasCover ? "orbit-polaroid-card--has-cover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/message/${entry.id}`} className={className}>
      <div className="orbit-polaroid-header">
        <div className="orbit-polaroid-user">
          <span className={`orbit-polaroid-avatar orbit-polaroid-avatar--${tone}`}>
            {initial}
          </span>
          {entry.author && (
            <span className="orbit-polaroid-author">{entry.author}</span>
          )}
        </div>
        {entry.entryDate != null && (
          <span className="orbit-polaroid-date">{formatDate(entry.entryDate)}</span>
        )}
      </div>

      <p className="orbit-polaroid-body">{body}</p>

      {hasCover && entry.coverUrl && (
        <div className="orbit-polaroid-frame">
          <img src={entry.coverUrl} alt="" className="orbit-polaroid-img" loading="lazy" />
        </div>
      )}
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

function formatPostmark(ts: number): { day: string; year: string } {
  const { y, m, day } = beijingDateParts(ts);
  return { day: `${m}·${day}`, year: String(y) };
}

function LetterEnvelope({
  entry,
  tone,
}: {
  entry: EntrySummary;
  tone: "a" | "b";
}) {
  const title = entryDisplayLabel(entry);
  const postmark = entry.entryDate != null ? formatPostmark(entry.entryDate) : null;

  return (
    <Link to={`/letter/${entry.id}`} className="orbit-env">
      <span className="orbit-env-flap" aria-hidden="true" />
      <span className={`orbit-env-seal orbit-seal--${tone}`} aria-hidden="true">
        {authorSealChar(entry.author)}
      </span>
      {postmark && (
        <span className="orbit-env-postmark" aria-hidden="true">
          <span className="orbit-env-postmark-day">{postmark.day}</span>
          <span className="orbit-env-postmark-year">{postmark.year}</span>
        </span>
      )}
      {entry.coverUrl && (
        <span className="orbit-env-stamp" aria-hidden="true">
          <img src={entry.coverUrl} alt="" loading="lazy" decoding="async" />
        </span>
      )}
      {entry.entryDate != null && (
        <span className="sr-only">{formatDateCn(entry.entryDate)}</span>
      )}
      {title ? <h3 className="orbit-env-to">{title}</h3> : null}
      <Snippet text={entry.snippet} className="orbit-env-snip" />
      {entry.author && <span className="orbit-env-sign">— {entry.author}</span>}
    </Link>
  );
}

function LetterReplyMini({
  reply,
  tone,
  tilt,
}: {
  reply: EntrySummary;
  tone: "a" | "b";
  tilt: "a" | "b";
}) {
  const text = entryDisplayLabel(reply) || reply.snippet || "回信";

  return (
    <Link
      to={`/letter/${reply.id}`}
      className={`orbit-reply-mini orbit-reply-mini--tilt-${tilt}`}
    >
      <span className="orbit-reply-mini-flap" aria-hidden="true" />
      <span
        className={`orbit-reply-mini-seal orbit-seal--${tone}`}
        aria-hidden="true"
      >
        {authorSealChar(reply.author)}
      </span>
      {reply.author && (
        <span className="orbit-reply-mini-author">{reply.author}</span>
      )}
      <p className="orbit-reply-mini-snip">{text}</p>
      {reply.entryDate != null && (
        <span className="orbit-reply-mini-date">{formatDate(reply.entryDate)}</span>
      )}
    </Link>
  );
}

function LetterThreadItem({
  thread,
  tones,
}: {
  thread: LetterThread;
  tones: Map<string, "a" | "b">;
}) {
  const { root, replies } = thread;
  const [expanded, setExpanded] = useState(false);
  const hasReplies = replies.length > 0;
  const peekReplies = replies.slice(0, 3);

  return (
    <article className="orbit-letter-thread">
      <div
        className={`orbit-letter-stack${hasReplies && !expanded ? " orbit-letter-stack--has-peeks" : ""}`}
      >
        <LetterEnvelope
          entry={root}
          tone={tones.get(authorToneKey(root)) ?? "a"}
        />

        {hasReplies && !expanded && (
          <button
            type="button"
            className="orbit-reply-peeks"
            aria-expanded={false}
            aria-label={formatReplySummary(replies)}
            onClick={() => setExpanded(true)}
          >
            {peekReplies.map((reply, index) => (
              <span
                key={reply.id}
                className="orbit-reply-peek"
                style={{ ["--peek-i" as string]: index }}
                aria-hidden="true"
              >
                <span
                  className={`orbit-reply-peek-seal orbit-seal--${tones.get(authorToneKey(reply)) ?? "b"}`}
                >
                  {authorSealChar(reply.author)}
                </span>
              </span>
            ))}
            <span className="orbit-reply-peeks-label">
              {replies.length === 1 ? "1 封回信" : `${replies.length} 封回信`}
            </span>
          </button>
        )}
      </div>

      {hasReplies && expanded && (
        <div className="orbit-reply-nest">
          {replies.map((reply, index) => (
            <LetterReplyMini
              key={reply.id}
              reply={reply}
              tone={tones.get(authorToneKey(reply)) ?? "b"}
              tilt={index % 2 === 0 ? "a" : "b"}
            />
          ))}
          <button
            type="button"
            className="orbit-reply-nest-collapse"
            onClick={() => setExpanded(false)}
          >
            收起回信
          </button>
        </div>
      )}
    </article>
  );
}

function TypedEntryList({
  type,
  entries,
  viewMode = "classic",
}: {
  type: string;
  entries: EntrySummary[];
  viewMode?: "classic" | "polaroid";
}) {
  const tones = useAuthorTones(entries);

  if (type === "message") {
    if (viewMode === "polaroid") {
      return (
        <ul className="orbit-list-plain orbit-msg-board-polaroid">
          {entries.map((entry, index) => (
            <li key={entry.id}>
              <PolaroidMessageCard
                entry={entry}
                tone={tones.get(authorToneKey(entry)) ?? "a"}
                tilt={index % 2 === 0 ? "a" : "b"}
              />
            </li>
          ))}
        </ul>
      );
    }

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
  const toastedError = useRef<unknown>(null);
  const [viewMode, setViewMode] = useState<"classic" | "polaroid">(() => {
    return (localStorage.getItem("orbit_msg_view_mode") as "classic" | "polaroid") || "classic";
  });

  const handleViewModeChange = (mode: "classic" | "polaroid") => {
    setViewMode(mode);
    localStorage.setItem("orbit_msg_view_mode", mode);
  };

  const isLetter = type === "letter";
  const paginated = Boolean(type) && !isLetter;
  const letterParams = { roots: false } as const;
  const pageParams = { pageSize: PAGE_SIZE } as const;

  const letterQuery = useQuery({
    queryKey: queryKeys.entries("letter", letterParams),
    queryFn: () => fetchEntries("letter", letterParams),
    enabled: isLetter,
  });

  const pagedQuery = useInfiniteQuery({
    queryKey: queryKeys.entries(type || "diary", pageParams),
    queryFn: ({ pageParam }): Promise<EntryListPage> =>
      fetchEntries(type!, { limit: PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((n, page) => n + page.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: paginated && Boolean(type),
  });

  const error = isLetter ? letterQuery.error : pagedQuery.error;
  useEffect(() => {
    if (!error || toastedError.current === error) return;
    toastedError.current = error;
    if (shouldToastApiError(error)) {
      toast.error(getApiErrorMessage(error, "加载失败，请稍后重试"));
    }
  }, [error, toast]);

  const entries: EntrySummary[] = useMemo(() => {
    if (isLetter) {
      const data = letterQuery.data;
      return Array.isArray(data) ? data : [];
    }
    return pagedQuery.data?.pages.flatMap((page) => page.items) ?? [];
  }, [isLetter, letterQuery.data, pagedQuery.data]);

  const tones = useAuthorTones(entries);
  const loading = isLetter ? letterQuery.isPending : pagedQuery.isPending;
  const loadingMore = pagedQuery.isFetchingNextPage;
  const label = TYPE_LABEL[type || ""] || type;
  const letterTree = useMemo(
    () => (isLetter ? buildLetterTree(entries) : []),
    [isLetter, entries]
  );
  const hasMore = paginated && pagedQuery.hasNextPage;

  return (
    <div className={`orbit-content${isLetter ? " orbit-content--desk" : ""}`}>
      <div className={isLetter ? "orbit-desk-toolbar" : "flex items-center justify-between mb-4"}>
        <h2 className="orbit-page-title">{label}</h2>
        <Link to={`/${type}/new`} className="orbit-btn orbit-btn-primary">
          {isLetter ? "写信" : "新建"}
        </Link>
      </div>

      {type === "message" && !loading && entries.length > 0 && (
        <div className="flex items-center justify-end mb-4">
          <div className="orbit-view-switcher" role="tablist" aria-label="视图切换">
            <button
              type="button"
              className={`orbit-view-switcher-btn${viewMode === "classic" ? " is-active" : ""}`}
              onClick={() => handleViewModeChange("classic")}
              title="切换为经典列表模式"
            >
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M2.5 4a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 2.5 4zm0 4a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5A.75.75 0 0 1 2.5 8zm0 4a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75z"/>
              </svg>
              <span>列表</span>
            </button>
            <button
              type="button"
              className={`orbit-view-switcher-btn${viewMode === "polaroid" ? " is-active" : ""}`}
              onClick={() => handleViewModeChange("polaroid")}
              title="切换为卡片模式"
            >
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M1.5 3A1.5 1.5 0 0 1 3 1.5h10A1.5 1.5 0 0 1 14.5 3v10a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V3zm1.5 0v7h10V3H3zm0 8.5v1.5h10v-1.5H3z"/>
              </svg>
              <span>卡片</span>
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="orbit-muted">加载中…</p>
      ) : entries.length === 0 ? (
        <div className="orbit-muted">
          <p>{isLetter ? "信箱还空着。" : "还没有内容。"}</p>
          <p>
            <Link to={`/${type}/new`} className="orbit-text-link">
              {isLetter ? "写下第一封信" : "写下第一篇"}
            </Link>
            {isLetter ? "，寄给最想念的人。" : "，记录这一刻。"}
          </p>
        </div>
      ) : isLetter ? (
        <ul className="orbit-list-plain orbit-desk">
          {letterTree.map((thread) => (
            <li key={thread.root.id} className="orbit-desk-item">
              <LetterThreadItem thread={thread} tones={tones} />
            </li>
          ))}
        </ul>
      ) : (
        <>
          <TypedEntryList type={type || "diary"} entries={entries} viewMode={viewMode} />
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                className="orbit-btn-ghost"
                disabled={loadingMore}
                onClick={() => void pagedQuery.fetchNextPage()}
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
