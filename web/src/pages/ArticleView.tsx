import { useEffect, useState, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { fetchEntry, formatDate, getApiErrorMessage, type EntryDetail } from "../lib/api";
import { useToast } from "../lib/useToast";
import { TiptapEditor } from "../components/TiptapEditor";
import { TableOfContents, MobileToc, extractToc } from "../components/TableOfContents";

export function ArticleView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const toast = useToast();
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchEntry(id)
      .then(setEntry)
      .catch((err) => {
        setError(true);
        toast.error(getApiErrorMessage(err, "加载失败"));
      });
  }, [id, toast]);

  const toc = useMemo(
    () => (entry ? extractToc(entry.body) : []),
    [entry]
  );

  if (error) return <p style={{ color: "oklch(0.55 0.18 27)" }}>文章不存在</p>;
  if (!entry) return <p style={{ color: "var(--color-text-muted)" }}>加载中…</p>;

  return (
    <div className="flex gap-8" style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* 文章主体 */}
      <div className="flex-1 min-w-0" style={{ maxWidth: "680px" }}>
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            {entry.title && (
              <h2 className="orbit-page-title" style={{ marginBottom: "0.25rem" }}>
                {entry.title}
              </h2>
            )}
            {entry.entryDate && (
              <p className="orbit-entry-date" style={{ marginTop: entry.title ? undefined : 0 }}>
                {formatDate(entry.entryDate)}
                {(entry.type === "message" || entry.type === "letter") && entry.author && (
                  <span style={{ marginLeft: "0.75rem" }}>{entry.author}</span>
                )}
              </p>
            )}
            {!entry.entryDate &&
              (entry.type === "message" || entry.type === "letter") &&
              entry.author && (
                <p className="orbit-entry-date">{entry.author}</p>
              )}
          </div>
          <Link to={`/${type}/${entry.id}/edit`} className="orbit-btn shrink-0">
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
