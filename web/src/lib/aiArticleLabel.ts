/** 从富文本/HTML 提取首段预览，供无标题文章的 AI 上下文 pill 使用 */
export function extractBodyPreview(html: string, maxLen = 36): string | null {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

/** AI 文章上下文 pill：标题 > 正文首行 > 当前文档 */
export function formatAiArticleContextLabel(entry: {
  title?: string | null;
  body?: string;
}): string {
  const title = entry.title?.trim();
  if (title) return title;
  const preview = extractBodyPreview(entry.body ?? "");
  if (preview) return preview;
  return "当前文档";
}
