export interface TocItem {
  level: number;
  text: string;
  id: string;
}

/** 从 HTML 或 Markdown 文本中提取标题 */
export function extractToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  let idx = 0;

  if (content.trimStart().startsWith("<")) {
    const matches = content.matchAll(/<h([1-4])[^>]*>(.*?)<\/h\1>/gi);
    for (const m of matches) {
      const level = parseInt(m[1]);
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      if (text) items.push({ level, text, id: `toc-${idx++}` });
    }
    return items;
  }

  for (const line of content.split("\n")) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      items.push({ level, text, id: `toc-${idx++}` });
    }
  }
  return items;
}
