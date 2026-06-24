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
import { useToast } from "../lib/useToast";

function EntryRow({ entry, type }: { entry: EntrySummary; type: string }) {
  const showAuthor = Boolean(entry.author);

  return (
    <Link to={`/${type}/${entry.id}`} className="orbit-entry-card">
      <span className="orbit-entry-card-main">
        {entry.title && (
          <span className="orbit-entry-title orbit-entry-title-truncate">
            {entry.title}
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

function buildLetterTree(entries: EntrySummary[]) {
  const repliesByParent = new Map<string, EntrySummary[]>();
  const roots: EntrySummary[] = [];

  for (const e of entries) {
    if (e.parentId) {
      const list = repliesByParent.get(e.parentId) ?? [];
      list.push(e);
      repliesByParent.set(e.parentId, list);
    } else {
      roots.push(e);
    }
  }

  for (const [, replies] of repliesByParent) {
    replies.sort((a, b) => (a.entryDate ?? 0) - (b.entryDate ?? 0));
  }

  roots.sort((a, b) => (b.entryDate ?? 0) - (a.entryDate ?? 0));

  return roots.map((root) => ({
    root,
    replies: repliesByParent.get(root.id) ?? [],
  }));
}

export function ArticleList() {
  const { type } = useParams<{ type: string }>();
  const toast = useToast();
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    fetchEntries(type, type === "letter" ? { roots: false } : undefined)
      .then(setEntries)
      .catch((err) => {
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载失败，请稍后重试"));
        }
        setEntries([]);
      })
      .finally(() => setLoading(false));
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
        <ul className="orbit-list-plain flex flex-col gap-2">
          {letterTree.map(({ root, replies }) => (
            <li key={root.id}>
              <EntryRow entry={root} type="letter" />
              {replies.length > 0 && (
                <ul className="orbit-list-plain orbit-letter-replies">
                  {replies.map((reply) => (
                    <li key={reply.id}>
                      <EntryRow entry={reply} type="letter" />
                    </li>
                  ))}
                </ul>
              )}
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
