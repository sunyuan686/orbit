import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchEntries, TYPE_LABEL, formatDate, type EntrySummary } from "../lib/api";

export function ArticleList() {
  const { type } = useParams<{ type: string }>();
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!type) return;
    setLoading(true);
    fetchEntries(type)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [type]);

  const label = TYPE_LABEL[type || ""] || type;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">{label}</h2>
        <Link
          to={`/${type}/new`}
          className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-800 rounded-lg hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors"
        >
          新建
        </Link>
      </div>

      {loading ? (
        <p className="text-stone-400">加载中...</p>
      ) : entries.length === 0 ? (
        <p className="text-stone-400">还没有内容，写下第一篇吧。</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/${type}/${entry.id}`}
                className="block px-4 py-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-stone-300 dark:hover:border-stone-600 hover:shadow-sm transition-all"
              >
                <span className="text-sm font-medium">
                  {entry.title || "（无标题）"}
                </span>
                {entry.entryDate && (
                  <span className="ml-3 text-xs text-stone-400 dark:text-stone-500">
                    {formatDate(entry.entryDate)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
