import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchEntry, formatDate, type EntryDetail } from "../lib/api";
import { TiptapEditor } from "../components/TiptapEditor";
import { TableOfContents, MobileToc, extractToc } from "../components/TableOfContents";

export function ArticleView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchEntry(id)
      .then(setEntry)
      .catch(() => setError(true));
  }, [id]);

  const toc = useMemo(
    () => (entry ? extractToc(entry.body) : []),
    [entry]
  );

  if (error) return <p className="text-red-500">文章不存在</p>;
  if (!entry) return <p className="text-stone-400">加载中...</p>;

  return (
    <div className="flex gap-8 max-w-5xl mx-auto">
      {/* 文章主体 */}
      <div className="flex-1 min-w-0 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">
              {entry.title || "（无标题）"}
            </h2>
            {entry.entryDate && (
              <p className="text-sm text-stone-400 mt-1">
                {formatDate(entry.entryDate)}
              </p>
            )}
          </div>
          <Link
            to={`/${type}/${entry.id}/edit`}
            className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-800 rounded-lg hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors shrink-0"
          >
            编辑
          </Link>
        </div>
        <TiptapEditor defaultValue={entry.body} readonly />
      </div>

      {/* 桌面端：右侧 TOC */}
      {toc.length > 0 && (
        <aside className="hidden xl:block w-56 shrink-0 sticky top-8 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          <TableOfContents items={toc} />
        </aside>
      )}

      {/* 移动端：浮动按钮 + 底部抽屉 */}
      <MobileToc items={toc} />
    </div>
  );
}
