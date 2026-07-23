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
  authorSealChar,
  buildThreadTimeline,
  entryDisplayLabel,
  entryToSummary,
  getThreadRootId,
} from "../lib/letterThread";

function authorTone(timeline: EntrySummary[]): Map<string, "a" | "b"> {
  const tones = new Map<string, "a" | "b">();
  for (const item of timeline) {
    const key = item.author ?? item.id;
    if (!tones.has(key)) tones.set(key, tones.size % 2 === 0 ? "a" : "b");
  }
  return tones;
}

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
      <section className="orbit-letter-thread-panel" aria-label="往来信件">
        <p className="orbit-muted orbit-letter-thread-panel-loading">加载往来信件…</p>
      </section>
    );
  }

  if (!timeline || timeline.length <= 1) {
    return null;
  }

  const tones = authorTone(timeline);

  return (
    <section className="orbit-letter-thread-panel" aria-label="往来信件">
      <div className="orbit-letter-thread-panel-head">
        <h3 className="orbit-letter-thread-panel-title">往来信件</h3>
        <span className="orbit-letter-thread-panel-count">
          共 {timeline.length} 封
        </span>
      </div>

      <ol className="orbit-letter-timeline">
        {timeline.map((item) => {
          const isCurrent = item.id === entry.id;
          const label = entryDisplayLabel(item);
          const tone = tones.get(item.author ?? item.id) ?? "a";

          return (
            <li
              key={item.id}
              className={
                isCurrent
                  ? "orbit-letter-timeline-item orbit-letter-timeline-item--current"
                  : "orbit-letter-timeline-item"
              }
            >
              <span
                className={`orbit-letter-timeline-seal orbit-seal--${tone}`}
                aria-hidden="true"
              >
                {authorSealChar(item.author)}
              </span>
              {isCurrent ? (
                <div className="orbit-letter-timeline-card">
                  <LetterTimelineMeta item={item} current />
                  {label && (
                    <p className="orbit-letter-timeline-preview">{label}</p>
                  )}
                </div>
              ) : (
                <Link
                  to={`/letter/${item.id}`}
                  className="orbit-letter-timeline-card orbit-letter-timeline-card--link"
                >
                  <LetterTimelineMeta item={item} />
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
  current = false,
}: {
  item: EntrySummary;
  current?: boolean;
}) {
  return (
    <div className="orbit-letter-timeline-meta">
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
      {current && <span className="orbit-letter-timeline-current">正在读</span>}
    </div>
  );
}
