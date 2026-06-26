import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchEntry,
  fetchReplies,
  formatDate,
  type EntryDetail,
  type EntrySummary,
} from "../lib/api";
import {
  buildThreadTimeline,
  entryDisplayLabel,
  entryToSummary,
  formatReplyCount,
  getThreadRootId,
} from "../lib/letterThread";

export function LetterThreadPanel({
  entry,
}: {
  entry: EntryDetail;
}) {
  const [timeline, setTimeline] = useState<EntrySummary[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const resolvedRootId = getThreadRootId(entry);

    async function load() {
      setLoading(true);
      try {
        const rootEntry =
          entry.parentId != null
            ? await fetchEntry(entry.parentId)
            : entry;
        const replies = await fetchReplies(resolvedRootId);
        if (cancelled) return;
        const rootSummary = entryToSummary(rootEntry);
        setTimeline(buildThreadTimeline(rootSummary, replies));
      } catch {
        if (!cancelled) {
          setTimeline(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  if (loading) {
    return (
      <section className="orbit-letter-thread-panel" aria-label="本轮通信">
        <p className="orbit-muted orbit-letter-thread-panel-loading">加载往来信件…</p>
      </section>
    );
  }

  if (!timeline || timeline.length <= 1) {
    return null;
  }

  return (
    <section className="orbit-letter-thread-panel" aria-label="本轮通信">
      <div className="orbit-letter-thread-panel-head">
        <h3 className="orbit-letter-thread-panel-title">本轮通信</h3>
        <span className="orbit-letter-thread-panel-count">
          {formatReplyCount(timeline.length - 1)}
        </span>
      </div>

      <ol className="orbit-letter-timeline">
        {timeline.map((item, index) => {
          const isReply = index > 0;
          const isCurrent = item.id === entry.id;
          const label = entryDisplayLabel(item);

          return (
            <li
              key={item.id}
              className={
                isCurrent
                  ? "orbit-letter-timeline-item orbit-letter-timeline-item--current"
                  : "orbit-letter-timeline-item"
              }
            >
              {isCurrent ? (
                <div className="orbit-letter-timeline-card">
                  <LetterTimelineMeta item={item} isReply={isReply} />
                  {label && (
                    <p className="orbit-letter-timeline-preview">{label}</p>
                  )}
                  <span className="orbit-letter-timeline-current">当前信件</span>
                </div>
              ) : (
                <Link
                  to={`/letter/${item.id}`}
                  className="orbit-letter-timeline-card orbit-letter-timeline-card--link"
                >
                  <LetterTimelineMeta item={item} isReply={isReply} />
                  {label && (
                    <p className="orbit-letter-timeline-preview">{label}</p>
                  )}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function LetterTimelineMeta({
  item,
  isReply,
}: {
  item: EntrySummary;
  isReply: boolean;
}) {
  return (
    <div className="orbit-letter-timeline-meta">
      <span className="orbit-letter-timeline-role">
        {isReply ? "回信" : "主信"}
      </span>
      {item.author && (
        <span className="orbit-letter-timeline-author">{item.author}</span>
      )}
      {item.entryDate && (
        <time
          className="orbit-letter-timeline-date"
          dateTime={formatDate(item.entryDate)}
        >
          {formatDate(item.entryDate)}
        </time>
      )}
    </div>
  );
}
