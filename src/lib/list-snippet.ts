import { toPlainText } from "./plain-text.js";

const LIST_SNIPPET_LEN = 100;

/** 列表预览：压空白并截断；空串返回 null（第一性原理：依赖上游纯净数据源） */
export function truncateListSnippet(
  text: string | null | undefined,
  max = LIST_SNIPPET_LEN
): string | null {
  if (!text) return null;
  const raw = text.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max)}…`;
}

/** memo.body 等可能含 HTML/Markdown 时先抽纯文本再截断。 */
export function snippetFromBody(
  body: string | null | undefined,
  max = LIST_SNIPPET_LEN
): string | null {
  return truncateListSnippet(toPlainText(body ?? ""), max);
}

