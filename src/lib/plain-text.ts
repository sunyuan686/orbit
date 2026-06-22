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

/**
 * 判断 body 是否为"空"：同时兼容纯文本、Markdown 与 Tiptap 输出的 HTML。
 * 去掉标签、图片、实体、空白后若无所剩，视为空。
 */
export function isEmptyBody(value: string | null | undefined): boolean {
  if (!value) return true;
  return value
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\s+/g, "")
    .length === 0;
}
