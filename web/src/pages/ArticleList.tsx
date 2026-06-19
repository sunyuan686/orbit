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
    <Link
      to={`/${type}/${entry.id}`}
      className="orbit-entry-card"
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.625rem 0.875rem",
        border: "1px solid var(--color-border-light)",
        textDecoration: "none",
      }}
    >
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "baseline",
          gap: "0.5rem",
          overflow: "hidden",
        }}
      >
        {entry.title && (
          <span
            className="orbit-entry-title"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {entry.title}
          </span>
        )}
        {showAuthor && entry.author && (
          <span
            style={{
              fontSize: "var(--type-secondary)",
              color: "var(--color-text-muted)",
              flexShrink: 0,
            }}
          >
            {entry.author}
          </span>
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
    <div style={{ maxWidth: "680px", margin: "0 auto" }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="orbit-page-title">{label}</h2>
        <Link to={`/${type}/new`} className="orbit-btn orbit-btn-primary">
          新建
        </Link>
      </div>

      {loading ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: "var(--type-secondary)" }}>
          加载中…
        </p>
      ) : entries.length === 0 ? (
        <div style={{ color: "var(--color-text-muted)", fontSize: "var(--type-secondary)" }}>
          <p>还没有内容。</p>
          <p>
            <Link to={`/${type}/new`} style={{ color: "var(--color-text-primary)", textDecoration: "underline" }}>
              写下第一篇
            </Link>
            ，记录这一刻。
          </p>
        </div>
      ) : type === "letter" ? (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {letterTree.map(({ root, replies }) => (
            <li key={root.id}>
              <EntryRow entry={root} type="letter" />
              {replies.length > 0 && (
                <ul
                  style={{
                    listStyle: "none",
                    margin: "0.25rem 0 0 0",
                    padding: "0 0 0 1.25rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.25rem",
                    borderLeft: "2px solid var(--color-border-light)",
                  }}
                >
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
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.375rem" }}>
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
