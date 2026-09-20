import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  getThreadRootId,
} from "../lib/letterThread";
import { queryKeys } from "../lib/queryKeys";

export function LetterThreadPanel({
  entry,
}: {
  entry: EntryDetail;
}) {
  const queryClient = useQueryClient();
  const resolvedRootId = getThreadRootId(entry);

  const { data: timeline } = useQuery({
    queryKey: ["letter-thread-timeline", resolvedRootId],
    queryFn: async () => {
      const rootEntry =
        entry.parentId != null
          ? await fetchEntry(entry.parentId)
          : entry;
      const replies = await fetchReplies(resolvedRootId);
      const rootSummary = entryToSummary(rootEntry);
      return buildThreadTimeline(rootSummary, replies);
    },
    staleTime: 60_000,
  });

  if (!timeline || timeline.length <= 1) {
    return null;
  }

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
                  <LetterTimelineMeta item={item} current />
                  {label && (
                    <p className="orbit-letter-timeline-preview">{label}</p>
                  )}
                </div>
              ) : (
                <Link
                  to={`/letter/${item.id}`}
                  onMouseEnter={() => {
                    void queryClient.prefetchQuery({
                      queryKey: queryKeys.entry(item.id),
                      queryFn: () => fetchEntry(item.id),
                    });
                  }}
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
