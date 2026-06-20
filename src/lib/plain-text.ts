/** 从 Markdown 提取纯文本，供搜索索引与摘要使用 */
export function toPlainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
