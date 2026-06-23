/**
 * ProseMirror 文档内的边注锚定工具。
 *
 * 采用三层混合策略（Hybrid Anchoring）：
 *   1. 位置优先：尝试 anchorFrom/anchorTo，验证选中文本是否匹配 quote
 *   2. 文本搜索：不匹配则遍历文档所有文本节点查找 quote
 *   3. 上下文消歧：多个匹配时用 anchorPrefix/anchorSuffix 区分
 *
 * 参考：Hypothesis TextQuoteSelector 算法
 *       https://github.com/hypothesis/dom-anchor-text-quote
 */
import type { Editor } from "@tiptap/react";

export interface AnchorCandidate {
  from: number;
  to: number;
}

export interface AnchorInput {
  anchorFrom: number | null;
  anchorTo: number | null;
  quote: string | null;
  anchorPrefix?: string | null;
  anchorSuffix?: string | null;
}

/**
 * 在 ProseMirror 文档中查找边注的锚定位置。
 * 返回 null 表示无法定位（文本已被修改或删除）。
 */
export function resolveCommentPosition(
  editor: Editor,
  input: AnchorInput,
): AnchorCandidate | null {
  const { doc } = editor.state;
  const quote = input.quote?.trim();
  if (!quote) return null;

  // ── 策略 1：位置优先 ──────────────────────────────────
  if (
    typeof input.anchorFrom === "number" &&
    typeof input.anchorTo === "number" &&
    input.anchorFrom >= 0 &&
    input.anchorTo <= doc.content.size &&
    input.anchorFrom < input.anchorTo
  ) {
    const textAtPos = doc.textBetween(input.anchorFrom, input.anchorTo, " ");
    if (textAtPos.trim() === quote) {
      return { from: input.anchorFrom, to: input.anchorTo };
    }
  }

  // ── 策略 2 & 3：文本搜索 + 上下文消歧 ─────────────────
  const matches: AnchorCandidate[] = [];

  // 遍历所有文本节点收集匹配
  doc.descendants((node, pos) => {
    if (!node.isText) return true;

    const text = node.text ?? "";
    const nodeStart = pos;
    let searchIdx = 0;

    while (searchIdx <= text.length) {
      const matchIdx = text.indexOf(quote, searchIdx);
      if (matchIdx === -1) break;
      matches.push({
        from: nodeStart + matchIdx,
        to: nodeStart + matchIdx + quote.length,
      });
      // 允许重叠匹配：每次前进 1 字符
      searchIdx = matchIdx + 1;
    }
    return true;
  });

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  // 多个匹配 → 用 prefix/suffix 消歧
  const prefix = input.anchorPrefix?.trim();
  const suffix = input.anchorSuffix?.trim();

  if (prefix || suffix) {
    for (const m of matches) {
      let matched = true;

      if (prefix) {
        const prefixStart = Math.max(0, m.from - prefix.length - 10); // 多取 10 字符容错
        const actualPrefix = doc.textBetween(prefixStart, m.from, " ");
        if (!actualPrefix.trimEnd().endsWith(prefix)) {
          matched = false;
        }
      }

      if (matched && suffix) {
        const suffixEnd = Math.min(doc.content.size, m.to + suffix.length + 10);
        const actualSuffix = doc.textBetween(m.to, suffixEnd, " ");
        if (!actualSuffix.trimStart().startsWith(suffix)) {
          matched = false;
        }
      }

      if (matched) return m;
    }
  }

  // 无法消歧 → 返回第一个匹配作为最佳尝试
  return matches[0];
}

/**
 * 获取选中文本的上下文（prefix/suffix），用于创建边注时一起存储。
 * 各取前后最多 50 个字符。
 */
export function getAnchorContext(
  editor: Editor,
  from: number,
  to: number,
  maxChars: number = 50,
): { prefix: string; suffix: string } {
  const { doc } = editor.state;
  const docSize = doc.content.size;

  // 取前面的文本（最多 maxChars 字符），截断到最近的自然段边界
  const prefixStart = Math.max(0, from - maxChars);
  const prefix = doc.textBetween(prefixStart, from, " ").trim();

  // 取后面的文本
  const suffixEnd = Math.min(docSize, to + maxChars);
  const suffix = doc.textBetween(to, suffixEnd, " ").trim();

  return { prefix, suffix };
}
