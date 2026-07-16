/** 从正文提取纯文本，供搜索索引与摘要使用（兼容 HTML / Markdown / 纯文本） */
export function toPlainText(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?(p|div|h[1-6]|li|ul|ol|blockquote|tr|table|section)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 判断 body 是否为"空"：同时兼容纯文本、Markdown 与 Tiptap 输出的 HTML。
 * 去掉标签、图片、实体、空白后若无所剩，视为空。
 */
export function isEmptyBody(value: string | null | undefined): boolean {
  if (!value) return true;
  return toPlainText(value).replace(/\s+/g, "").length === 0;
}
