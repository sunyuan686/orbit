import {
  formatDate,
  formatDateCn,
  formatDateTime,
  isSameLocalDay,
  wasEdited,
} from "../lib/api";

interface ArticleMetadataProps {
  title?: string | null;
  type: string;
  author: string | null;
  modifiedBy: string | null;
  entryDate: number | null;
  createdAt?: number;
  updatedAt?: number;
}

export function ArticleMetadata({
  title,
  type,
  author,
  modifiedBy,
  entryDate,
  createdAt,
  updatedAt,
}: ArticleMetadataProps) {
  const edited = wasEdited(createdAt, updatedAt);
  const editor = modifiedBy || author;
  const showCrossEdit = Boolean(
    edited && editor && author && editor !== author
  );
  const showEntryDate =
    entryDate != null &&
    type !== "memo" &&
    (createdAt == null || !isSameLocalDay(entryDate, createdAt));

  return (
    <div className="orbit-article-meta-group">
      {title && title.trim() ? (
        <h1 className="orbit-article-title">{title}</h1>
      ) : null}
      <div className="orbit-article-meta" aria-label="文档信息">
        {showEntryDate && (
          <time
            className="orbit-article-meta-date"
            dateTime={formatDate(entryDate!)}
          >
            {formatDateCn(entryDate!)}
          </time>
        )}
        <p className="orbit-article-meta-prose">
          {author && createdAt != null && (
            <>
              <span className="orbit-article-meta-who">{author}</span>
              {" 创建于 "}
              <time dateTime={String(createdAt)}>{formatDateTime(createdAt)}</time>
            </>
          )}
          {edited && updatedAt != null && (
            <>
              {author && createdAt != null && (
                <span className="orbit-article-meta-sep" aria-hidden>
                  {" · "}
                </span>
              )}
              {showCrossEdit && (
                <>
                  <span className="orbit-article-meta-who">{editor}</span>
                  {" "}
                </>
              )}
              更新于{" "}
              <time dateTime={String(updatedAt)}>{formatDateTime(updatedAt)}</time>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
