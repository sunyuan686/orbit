import { Link } from "react-router-dom";
import { formatDate, type EntrySummary } from "../lib/api";
import { entryDisplayLabel } from "../lib/letterThread";
import { GalleryImage } from "./GalleryImage";
import { useMomentTags } from "../hooks/useMomentTags";
import { TAG_BADGE_CLASS } from "../lib/tagColor";
import { MicIcon } from "./OrbitIcons";

export interface MomentCardProps {
  entry: EntrySummary;
  layout?: "feed" | "timeline" | "list" | "card";
}

export function MomentCard({ entry, layout = "feed" }: MomentCardProps) {
  const { tagMap } = useMomentTags();
  const displayText = entryDisplayLabel(entry);
  const snippet = entry.snippet?.trim() || "";
  const title = entry.title?.trim() || null;
  const initial = entry.author ? entry.author.charAt(0) : "★";
  const isToneB = Boolean(
    entry.author &&
      (entry.author.includes("麟") || entry.author.toLowerCase().includes("lin"))
  );

  const renderTagBadge = (tagId: string | null | undefined) => {
    if (!tagId) return null;
    const tagItem = tagMap[tagId];
    const displayName = tagItem?.name || tagId;

    return (
      <span className={TAG_BADGE_CLASS}>
        {displayName}
      </span>
    );
  };

  /* 列表视图：单列信息流长文展示 */
  if (layout === "list") {
    const hasVoice = Boolean(entry.hasAudio);

    return (
      <Link
        to={`/moment/${entry.id}`}
        className="group block p-4 sm:p-5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] shadow-xs hover:border-[var(--color-accent)]/40 hover:shadow-sm transition-[border-color,box-shadow,background-color] duration-150 text-inherit no-underline"
      >
        {/* 顶部作者与时间栏（同组聚集，遵循亲密性法则） */}
        <div className="flex items-center gap-2 mb-2.5 text-xs">
          <span
            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white shrink-0 ${
              isToneB ? "bg-amber-600/90" : "bg-[var(--color-accent)]"
            }`}
          >
            {initial}
          </span>
          {entry.author && (
            <span className="font-medium text-[var(--color-text-secondary)]">
              {entry.author}
            </span>
          )}
          {entry.entryDate != null && (
            <>
              <span className="text-[var(--color-text-muted)] text-[10px]" aria-hidden>
                ·
              </span>
              <span className="font-mono text-[11px] text-[var(--color-text-muted)] tracking-tight">
                {formatDate(entry.entryDate)}
              </span>
            </>
          )}
          {hasVoice && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--color-accent)] font-mono ml-1">
              <MicIcon size="sm" className="w-3 h-3" />
              <span>语音</span>
            </span>
          )}
          {entry.tag && <div className="ml-auto">{renderTagBadge(entry.tag)}</div>}
        </div>

        {/* 动态标题与正文 */}
        <div className="min-w-0 flex-1">
          {title && (
            <h3 className="font-heading text-base font-medium text-[var(--color-text-primary)] mb-1 leading-snug">
              {title}
            </h3>
          )}
          <p className="font-sans text-[0.9375rem] leading-[1.72] text-[var(--color-text-primary)] line-clamp-6 whitespace-pre-wrap break-words">
            {snippet || displayText || "（查看动态详情）"}
          </p>
        </div>

        {/* 封面多媒体图片 */}
        {entry.coverUrl && (
          <div className="mt-3 rounded-lg overflow-hidden border border-[var(--color-border-light)] bg-[var(--color-surface-raised)] max-h-72 sm:max-h-96 flex items-center justify-center">
            <GalleryImage
              src={entry.coverUrl}
              blurhash={entry.coverBlurhash}
              width={entry.coverWidth}
              height={entry.coverHeight}
              className="w-full h-auto max-h-72 sm:max-h-96 object-cover"
              imgClassName="w-full h-auto max-h-72 sm:max-h-96 object-cover rounded-lg"
            />
          </div>
        )}
      </Link>
    );
  }

  /* 里程碑视图：时间轴流 */
  if (layout === "timeline") {
    const hasCover = Boolean(entry.coverUrl);
    return (
      <div className="orbit-tl-item">
        <Link
          to={`/moment/${entry.id}`}
          className={`orbit-tl-card${hasCover ? " orbit-tl-card--has-cover" : ""}`}
        >
          <div className="orbit-tl-card-body">
            <div className="flex items-center gap-2">
              {entry.entryDate != null && (
                <span className="orbit-tl-card-date">
                  {formatDate(entry.entryDate)}
                </span>
              )}
              {entry.author && (
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  @{entry.author}
                </span>
              )}
              {renderTagBadge(entry.tag)}
            </div>
            {title && (
              <h3 className="orbit-tl-card-title font-heading">{title}</h3>
            )}
            {(snippet || displayText) && (
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                {snippet || displayText}
              </p>
            )}
          </div>
          {entry.coverUrl && (
            <GalleryImage
              src={entry.coverUrl}
              blurhash={entry.coverBlurhash}
              width={entry.coverWidth}
              height={entry.coverHeight}
              className="orbit-tl-card-cover"
            />
          )}
        </Link>
      </div>
    );
  }

  /* 卡片视图（默认/feed/card）：小红书双列卡片风格，图片置顶，紧凑摘要，底部作者信息 */
  const hasCover = Boolean(entry.coverUrl);
  const hasVoice = Boolean(entry.hasAudio);

  return (
    <Link
      to={`/moment/${entry.id}`}
      className="group flex flex-col rounded-xl bg-[var(--color-surface)] border border-[var(--color-border-light)] shadow-xs hover:border-[var(--color-border)] hover:shadow-sm transition-[border-color,box-shadow] duration-150 text-inherit no-underline overflow-hidden"
    >
      {/* 顶部封面大图（置顶展示，小红书视觉优先） */}
      {hasCover && (
        <div className="w-full relative overflow-hidden bg-[var(--color-surface-raised)] aspect-[4/5] sm:aspect-[3/4] max-h-64 flex items-center justify-center">
          <GalleryImage
            src={entry.coverUrl!}
            blurhash={entry.coverBlurhash}
            width={entry.coverWidth}
            height={entry.coverHeight}
            className="w-full h-full object-cover"
            imgClassName="w-full h-full object-cover orbit-card-cover-zoom"
          />
          {hasVoice && (
            <span className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] text-white flex items-center gap-1 font-mono select-none">
              <MicIcon size="sm" className="w-3 h-3" />
              <span>语音</span>
            </span>
          )}
        </div>
      )}

      {/* 卡片内容区 */}
      <div
        className={`flex flex-col flex-1 justify-between ${
          hasCover ? "p-2.5 sm:p-3" : "p-3.5 sm:p-4 min-h-[130px]"
        }`}
      >
        <div>
          {/* 无图卡片：展示微便签与语音指示 */}
          {!hasCover && hasVoice && (
            <div className="mb-1.5 flex items-center gap-1 text-[11px] text-[var(--color-accent)] font-mono">
              <MicIcon size="sm" className="w-3.5 h-3.5" />
              <span>语音动态</span>
            </div>
          )}

          {title && (
            <h3 className="font-heading text-[13px] sm:text-sm font-medium text-[var(--color-text-primary)] line-clamp-2 leading-snug mb-1">
              {title}
            </h3>
          )}

          <p
            className={`font-sans text-[11px] sm:text-xs leading-relaxed text-[var(--color-text-secondary)] whitespace-pre-wrap break-words ${
              hasCover ? "line-clamp-2 mb-2" : "line-clamp-4 mb-3"
            }`}
          >
            {snippet || displayText || "（查看动态详情）"}
          </p>
        </div>

        {/* 底部作者与时间栏（小红书经典下置排版） */}
        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-[var(--color-border-light)]/60 text-[11px] text-[var(--color-text-muted)] mt-auto">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-medium text-white shrink-0 ${
                isToneB ? "bg-amber-600/90" : "bg-[var(--color-accent)]"
              }`}
            >
              {initial}
            </span>
            {entry.author && (
              <span className="truncate max-w-[56px] sm:max-w-[72px] text-[var(--color-text-secondary)]">
                {entry.author}
              </span>
            )}
            {renderTagBadge(entry.tag)}
          </div>

          {entry.entryDate != null && (
            <span className="font-mono text-[10px] sm:text-[11px] tracking-tight shrink-0 text-[var(--color-text-muted)]">
              {formatDate(entry.entryDate)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
