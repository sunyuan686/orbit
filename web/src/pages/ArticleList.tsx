import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  beijingDateParts,
  fetchEntries,
  fetchSpaceStatus,
  getSpaceYear,
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
import { useToast } from "../hooks/useToast";
import { Container } from "../components/ui";
import { GalleryImage } from "../components/GalleryImage";
import { GridViewIcon, ListViewIcon, SortIcon } from "../components/OrbitIcons";

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
  entry,
  className,
  imgClassName,
}: {
  entry: EntrySummary;
  className?: string;
  imgClassName?: string;
}) {
  if (!entry.coverUrl) return null;
  return (
    <GalleryImage
      src={entry.coverUrl}
      blurhash={entry.coverBlurhash}
      width={entry.coverWidth}
      height={entry.coverHeight}
      className={className}
      imgClassName={imgClassName}
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
      <CoverImg entry={entry} className="orbit-msg-card-cover" />
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
}: {
  entry: EntrySummary;
  tone: "a" | "b";
}) {
  const body = entry.snippet || entry.title || "（无内容）";
  const hasCover = Boolean(entry.coverUrl);
  const initial = entry.author ? entry.author.charAt(0) : "★";
  const className = [
    "orbit-polaroid-card",
    `orbit-polaroid-card--${tone}`,
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
          <CoverImg entry={entry} imgClassName="orbit-polaroid-img" />
        </div>
      )}
    </Link>
  );
}

function DiaryGridCard({
  entry,
  tone,
}: {
  entry: EntrySummary;
  tone: "a" | "b";
}) {
  const customTitle = entry.title?.trim() || null;
  const snippet = entry.snippet?.trim() || "";
  const hasCover = Boolean(entry.coverUrl);
  const initial = entry.author ? entry.author.charAt(0) : "日";
  const className = [
    "orbit-polaroid-card",
    `orbit-polaroid-card--${tone}`,
    hasCover ? "orbit-polaroid-card--has-cover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/diary/${entry.id}`} className={className}>
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

      <div className="orbit-polaroid-content">
        {customTitle ? (
          <>
            <h3 className="orbit-polaroid-title">{customTitle}</h3>
            {snippet && <p className="orbit-polaroid-body orbit-polaroid-body--has-title">{snippet}</p>}
          </>
        ) : (
          <p className="orbit-polaroid-body">{snippet || "（查看日记内容）"}</p>
        )}
      </div>

      {hasCover && entry.coverUrl && (
        <div className="orbit-polaroid-frame">
          <CoverImg entry={entry} imgClassName="orbit-polaroid-img" />
        </div>
      )}
    </Link>
  );
}

function TimelineGridCard({
  entry,
  tone,
}: {
  entry: EntrySummary;
  tone: "a" | "b";
}) {
  const customTitle = entry.title?.trim() || null;
  const snippet = entry.snippet?.trim() || "";
  const hasCover = Boolean(entry.coverUrl);
  const initial = entry.author ? entry.author.charAt(0) : "轨";
  const className = [
    "orbit-polaroid-card",
    `orbit-polaroid-card--${tone}`,
    hasCover ? "orbit-polaroid-card--has-cover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/timeline/${entry.id}`} className={className}>
      <div className="orbit-polaroid-header">
        <div className="orbit-polaroid-user">
          <span className={`orbit-polaroid-avatar orbit-polaroid-avatar--${tone}`}>
            {initial}
          </span>
          {entry.author ? (
            <span className="orbit-polaroid-author">{entry.author}</span>
          ) : (
            <span className="orbit-polaroid-author">时间线</span>
          )}
        </div>
        {entry.entryDate != null && (
          <span className="orbit-polaroid-date">{formatDate(entry.entryDate)}</span>
        )}
      </div>

      <div className="orbit-polaroid-content">
        {customTitle ? (
          <>
            <h3 className="orbit-polaroid-title">{customTitle}</h3>
            {snippet && <p className="orbit-polaroid-body orbit-polaroid-body--has-title">{snippet}</p>}
          </>
        ) : (
          <p className="orbit-polaroid-body">{snippet || "（查看时刻详情）"}</p>
        )}
      </div>

      {hasCover && entry.coverUrl && (
        <div className="orbit-polaroid-frame">
          <CoverImg entry={entry} imgClassName="orbit-polaroid-img" />
        </div>
      )}
    </Link>
  );
}

function NoteGridCard({
  entry,
  tone,
}: {
  entry: EntrySummary;
  tone: "a" | "b";
}) {
  const customTitle = entry.title?.trim() || null;
  const snippet = entry.snippet?.trim() || "";
  const hasCover = Boolean(entry.coverUrl);
  const initial = entry.author ? entry.author.charAt(0) : "随";
  const className = [
    "orbit-polaroid-card",
    `orbit-polaroid-card--${tone}`,
    hasCover ? "orbit-polaroid-card--has-cover" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Link to={`/note/${entry.id}`} className={className}>
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

      <div className="orbit-polaroid-content">
        {customTitle ? (
          <>
            <h3 className="orbit-polaroid-title">{customTitle}</h3>
            {snippet && <p className="orbit-polaroid-body orbit-polaroid-body--has-title">{snippet}</p>}
          </>
        ) : (
          <p className="orbit-polaroid-body">{snippet || "（查看随想内容）"}</p>
        )}
      </div>

      {hasCover && entry.coverUrl && (
        <div className="orbit-polaroid-frame">
          <CoverImg entry={entry} imgClassName="orbit-polaroid-img" />
        </div>
      )}
    </Link>
  );
}

function AppreciationGridCard({
  entry,
  tone,
}: {
  entry: EntrySummary;
  tone: "a" | "b";
}) {
  const customTitle = entry.title?.trim() || null;
  const snippet = entry.snippet?.trim() || "";
  const hasCover = Boolean(entry.coverUrl);
  const initial = entry.author ? entry.author.charAt(0) : "谢";

  return (
    <Link to={`/appreciation/${entry.id}`} className="orbit-appreciation-card">
      <div className="orbit-appreciation-header">
        <div className="orbit-polaroid-user">
          <span className={`orbit-polaroid-avatar orbit-polaroid-avatar--${tone}`}>
            {initial}
          </span>
          <span className="orbit-polaroid-author">
            {entry.author ? `来自 ${entry.author} 的感谢` : "暖心感谢"}
          </span>
        </div>
        {entry.entryDate != null && (
          <span className="orbit-polaroid-date">{formatDate(entry.entryDate)}</span>
        )}
      </div>

      <div className="orbit-polaroid-content">
        {customTitle ? (
          <>
            <h3 className="orbit-appreciation-title">{customTitle}</h3>
            {snippet && <p className="orbit-polaroid-body orbit-polaroid-body--has-title">{snippet}</p>}
          </>
        ) : (
          <p className="orbit-polaroid-body">{snippet || "（查看感谢详情）"}</p>
        )}
      </div>

      {hasCover && entry.coverUrl && (
        <div className="orbit-polaroid-frame">
          <CoverImg entry={entry} imgClassName="orbit-polaroid-img" />
        </div>
      )}
    </Link>
  );
}

function NoteListCard({ entry }: { entry: EntrySummary }) {
  const title = entry.title?.trim() || null;
  const hasCover = Boolean(entry.coverUrl);

  return (
    <Link to={`/note/${entry.id}`} className="orbit-memo-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {title && <h3 className="orbit-memo-card-title">{title}</h3>}
          <Snippet text={entry.snippet} />
        </div>
        {hasCover && entry.coverUrl && (
          <div className="w-16 h-16 shrink-0 rounded overflow-hidden border border-[var(--color-border-light)]">
            <CoverImg entry={entry} imgClassName="w-full h-full object-cover" />
          </div>
        )}
      </div>
      <div className="orbit-memo-card-foot">
        {entry.author && <span className="orbit-entry-author">{entry.author}</span>}
        {entry.entryDate != null && (
          <span className="orbit-memo-card-updated">{formatDate(entry.entryDate)}</span>
        )}
      </div>
    </Link>
  );
}

function AppreciationListCard({ entry }: { entry: EntrySummary }) {
  const title = entry.title?.trim() || null;
  const hasCover = Boolean(entry.coverUrl);

  return (
    <Link to={`/appreciation/${entry.id}`} className="orbit-memo-card">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {title && <h3 className="orbit-memo-card-title">{title}</h3>}
          <Snippet text={entry.snippet} />
        </div>
        {hasCover && entry.coverUrl && (
          <div className="w-16 h-16 shrink-0 rounded overflow-hidden border border-[var(--color-border-light)]">
            <CoverImg entry={entry} imgClassName="w-full h-full object-cover" />
          </div>
        )}
      </div>
      <div className="orbit-memo-card-foot">
        <span className="orbit-entry-author">
          {entry.author ? `来自 ${entry.author} 的感谢` : "暖心感谢"}
        </span>
        {entry.entryDate != null && (
          <span className="orbit-memo-card-updated">{formatDate(entry.entryDate)}</span>
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
          <CoverImg entry={entry} className="orbit-diary-card-cover" />
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
        <CoverImg entry={entry} className="orbit-tl-card-cover" />
      </Link>
    </div>
  );
}

function MemoCard({ entry }: { entry: EntrySummary }) {
  const isCustomKey = Boolean(entry.key && !entry.key.startsWith("memo-"));
  const title = entry.title?.trim() || null;

  return (
    <Link to={`/memo/${entry.id}`} className="orbit-memo-card">
      {isCustomKey && <div className="orbit-memo-card-key">{entry.key}</div>}
      {title && <h3 className="orbit-memo-card-title">{title}</h3>}
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
  const customTitle = entry.title?.trim() || null;
  const snippet = entry.snippet?.trim() || "";
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
          <CoverImg entry={entry} />
        </span>
      )}
      {entry.entryDate != null && (
        <span className="sr-only">{formatDateCn(entry.entryDate)}</span>
      )}
      {customTitle ? (
        <>
          <h3 className="orbit-env-title">{customTitle}</h3>
          {snippet && <p className="orbit-env-body orbit-env-body--has-title">{snippet}</p>}
        </>
      ) : (
        <p className="orbit-env-body">{snippet || "（查看信件内容）"}</p>
      )}
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
  const text = reply.title?.trim() || reply.snippet?.trim() || "回信";

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
          {entries.map((entry) => (
            <li key={entry.id}>
              <PolaroidMessageCard
                entry={entry}
                tone={tones.get(authorToneKey(entry)) ?? "a"}
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
    if (viewMode === "polaroid") {
      return (
        <ul className="orbit-list-plain orbit-msg-board-polaroid">
          {entries.map((entry) => (
            <li key={entry.id}>
              <DiaryGridCard
                entry={entry}
                tone={tones.get(authorToneKey(entry)) ?? "a"}
              />
            </li>
          ))}
        </ul>
      );
    }

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
    if (viewMode === "polaroid") {
      return (
        <ul className="orbit-list-plain orbit-msg-board-polaroid">
          {entries.map((entry) => (
            <li key={entry.id}>
              <TimelineGridCard
                entry={entry}
                tone={tones.get(authorToneKey(entry)) ?? "a"}
              />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <div className="orbit-tl-wrap">
        {entries.map((entry) => (
          <TimelineCard key={entry.id} entry={entry} />
        ))}
      </div>
    );
  }

  if (type === "note") {
    if (viewMode === "classic") {
      return (
        <ul className="orbit-list-plain orbit-memo-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <NoteListCard entry={entry} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <ul className="orbit-list-plain orbit-msg-board-polaroid">
        {entries.map((entry) => (
          <li key={entry.id}>
            <NoteGridCard
              entry={entry}
              tone={tones.get(authorToneKey(entry)) ?? "a"}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (type === "appreciation") {
    if (viewMode === "classic") {
      return (
        <ul className="orbit-list-plain orbit-memo-list">
          {entries.map((entry) => (
            <li key={entry.id}>
              <AppreciationListCard entry={entry} />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <ul className="orbit-list-plain orbit-msg-board-polaroid">
        {entries.map((entry) => (
          <li key={entry.id}>
            <AppreciationGridCard
              entry={entry}
              tone={tones.get(authorToneKey(entry)) ?? "a"}
            />
          </li>
        ))}
      </ul>
    );
  }

  if (type === "memo") {
    if (viewMode === "polaroid") {
      return (
        <ul className="orbit-list-plain orbit-msg-board-polaroid">
          {entries.map((entry) => (
            <li key={entry.id}>
              <MemoCard entry={entry} />
            </li>
          ))}
        </ul>
      );
    }

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

interface FilterOption<T> {
  value: T;
  label: string;
}

function FilterChipDropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  allLabel = "全部",
}: {
  label: string;
  value: T | null;
  options: FilterOption<T>[];
  onChange: (value: T | null) => void;
  allLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [open]);

  const activeOption = options.find((o) => o.value === value);
  const hasFilter = value !== null;

  return (
    <div ref={containerRef} className="orbit-filter-chip-wrap">
      <button
        type="button"
        className={`orbit-filter-chip${hasFilter ? " is-active" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{hasFilter ? activeOption?.label ?? String(value) : label}</span>
        {hasFilter ? (
          <span
            className="orbit-filter-chip-clear"
            role="button"
            title="清除筛选"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setOpen(false);
            }}
          >
            ×
          </span>
        ) : (
          <span className="orbit-filter-chip-arrow" aria-hidden>
            ▾
          </span>
        )}
      </button>

      {open && (
        <div className="orbit-filter-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            className={`orbit-filter-menu-item${value === null ? " is-active" : ""}`}
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
          >
            <span>{allLabel}</span>
            {value === null && <span className="orbit-filter-check">✓</span>}
          </button>
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="menuitem"
              className={`orbit-filter-menu-item${value === opt.value ? " is-active" : ""}`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {value === opt.value && <span className="orbit-filter-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ArticleList() {
  const { type } = useParams<{ type: string }>();
  const toast = useToast();
  const toastedError = useRef<unknown>(null);

  const statusQuery = useQuery({
    queryKey: queryKeys.spaceStatus,
    queryFn: fetchSpaceStatus,
    staleTime: 5 * 60_000,
  });

  const [year, setYear] = useState<number | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [order, setOrder] = useState<"asc" | "desc">("desc");

  const isLetter = type === "letter";
  const supportsViewSwitch = !isLetter;

  const [viewMode, setViewMode] = useState<"classic" | "polaroid">(() => {
    const key = type ? `orbit_view_mode_${type}` : "orbit_view_mode";
    const saved = localStorage.getItem(key);
    if (saved === "polaroid" || saved === "classic") return saved;
    return type === "timeline" || type === "note" || type === "appreciation" || type === "message"
      ? "polaroid"
      : "classic";
  });

  useEffect(() => {
    if (!type) return;
    const saved = localStorage.getItem(`orbit_view_mode_${type}`);
    if (saved === "polaroid" || saved === "classic") {
      setViewMode(saved);
    } else {
      setViewMode(
        type === "timeline" || type === "note" || type === "appreciation" || type === "message"
          ? "polaroid"
          : "classic"
      );
    }
  }, [type]);

  useEffect(() => {
    setYear(null);
    setAuthor(null);
    setOrder("desc");
  }, [type]);

  const handleViewModeChange = (mode: "classic" | "polaroid") => {
    setViewMode(mode);
    if (type) {
      localStorage.setItem(`orbit_view_mode_${type}`, mode);
    }
  };

  const paginated = Boolean(type) && !isLetter;
  const letterParams = useMemo(
    () => ({
      roots: false,
      year: year ?? undefined,
      author: author ?? undefined,
      order,
    }),
    [year, author, order]
  );
  const pageParams = useMemo(
    () => ({
      pageSize: PAGE_SIZE,
      year: year ?? undefined,
      author: author ?? undefined,
      order,
    }),
    [year, author, order]
  );

  const letterQuery = useQuery({
    queryKey: queryKeys.entries("letter", letterParams),
    queryFn: () => fetchEntries("letter", letterParams),
    enabled: isLetter,
  });

  const pagedQuery = useInfiniteQuery({
    queryKey: queryKeys.entries(type || "diary", pageParams),
    queryFn: ({ pageParam }): Promise<EntryListPage> =>
      fetchEntries(type!, {
        limit: PAGE_SIZE,
        offset: pageParam,
        year: year ?? undefined,
        author: author ?? undefined,
        order,
      }),
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

  const currentYear = getSpaceYear();
  const earliestYear = useMemo(() => {
    if (isLetter) {
      if (!entries.length) return currentYear;
      let minYear = currentYear;
      for (const e of entries) {
        if (e.entryDate) {
          const yr = beijingDateParts(e.entryDate).y;
          if (yr < minYear) minYear = yr;
        }
      }
      return minYear;
    }
    return pagedQuery.data?.pages[0]?.earliestYear ?? currentYear;
  }, [isLetter, entries, pagedQuery.data?.pages, currentYear]);

  const startYear = Math.min(earliestYear, currentYear);

  const years = useMemo(() => {
    const list: number[] = [];
    for (let y = currentYear; y >= startYear; y--) {
      list.push(y);
    }
    return list;
  }, [currentYear, startYear]);

  const yearOptions = useMemo(
    () => years.map((y) => ({ value: y, label: `${y}年` })),
    [years]
  );

  const authorOptions = useMemo(() => {
    const set = new Set<string>();
    if (statusQuery.data?.authors) {
      for (const a of statusQuery.data.authors) {
        if (a.name) set.add(a.name);
      }
    }
    for (const e of entries) {
      if (e.author) set.add(e.author);
    }
    return Array.from(set).map((a) => ({ value: a, label: a }));
  }, [statusQuery.data?.authors, entries]);

  const tones = useAuthorTones(entries);
  const loading = isLetter ? letterQuery.isPending : pagedQuery.isPending;
  const loadingMore = pagedQuery.isFetchingNextPage;
  const label = TYPE_LABEL[type || ""] || type;
  const letterTree = useMemo(
    () => (isLetter ? buildLetterTree(entries, order) : []),
    [isLetter, entries, order]
  );
  const hasMore = paginated && pagedQuery.hasNextPage;
  const hasActiveFilter = year != null || author != null;

  return (
    <Container size="standard" className={isLetter ? "orbit-content--desk" : undefined}>
      <header className="orbit-page-header">
        <h1 className="orbit-page-title">{label}</h1>
      </header>

      <div className="orbit-content-toolbar">
        <div className="orbit-content-toolbar-group">
          <FilterChipDropdown
            label="年份"
            value={year}
            options={yearOptions}
            onChange={setYear}
            allLabel="全部"
          />
          <FilterChipDropdown
            label="作者"
            value={author}
            options={authorOptions}
            onChange={setAuthor}
            allLabel="全部"
          />
        </div>

        <div className="orbit-content-toolbar-group">
          <button
            type="button"
            className="orbit-filter-action-btn orbit-filter-icon-btn"
            onClick={() => setOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
            title={
              order === "desc"
                ? "当前为最新优先，点击切换为最早优先"
                : "当前为最早优先，点击切换为最新优先"
            }
            aria-label={order === "desc" ? "排序：最新优先" : "排序：最早优先"}
          >
            <SortIcon className="w-3.5 h-3.5" />
          </button>
          {supportsViewSwitch && !loading && (
            <button
              type="button"
              className="orbit-filter-action-btn orbit-filter-icon-btn"
              onClick={() => handleViewModeChange(viewMode === "polaroid" ? "classic" : "polaroid")}
              title={viewMode === "polaroid" ? "切换为列表视图" : "切换为卡片视图"}
              aria-label={viewMode === "polaroid" ? "切换为列表视图" : "切换为卡片视图"}
            >
              {viewMode === "polaroid" ? (
                <GridViewIcon className="w-3.5 h-3.5" />
              ) : (
                <ListViewIcon className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <Link
            to={`/${type}/new`}
            className="orbit-btn orbit-btn-sm"
            title={isLetter ? "写信" : type === "timeline" ? "记录" : "新建"}
          >
            <span className="sm:hidden">{isLetter ? "写信" : "＋"}</span>
            <span className="hidden sm:inline">
              {isLetter ? "写信" : type === "timeline" ? "＋ 记录" : "＋ 新建"}
            </span>
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="orbit-muted">加载中…</p>
      ) : entries.length === 0 ? (
        <div className="orbit-muted">
          {hasActiveFilter ? (
            <div className="py-8 text-center space-y-2">
              <p>所选条件下暂无内容。</p>
              <button
                type="button"
                className="orbit-text-link cursor-pointer text-sm"
                onClick={() => {
                  setYear(null);
                  setAuthor(null);
                }}
              >
                清除筛选条件
              </button>
            </div>
          ) : (
            <>
              <p>{isLetter ? "信箱还空着。" : "还没有内容。"}</p>
              <p>
                <Link to={`/${type}/new`} className="orbit-text-link">
                  {isLetter ? "写下第一封信" : "写下第一篇"}
                </Link>
                {isLetter ? "，寄给最想念的人。" : "，记录这一刻。"}
              </p>
            </>
          )}
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
    </Container>
  );
}
