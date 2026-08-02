/** 将 Markdown 图片语法转为 TipTap 可用的 <img> 标签 */
function mdImageToHtml(alt: string, src: string): string {
  let url = src;
  if (src.startsWith("assets/")) url = `/${src}`;
  else if (src.startsWith("/assets/")) url = src;
  return `<img src="${url}" alt="${alt}" class="orbit-prose-img" />`;
}

/**
 * 将历史 Markdown 正文转为 TipTap HTML。
 * 已是 TipTap HTML 时原样返回（仅补转内嵌的 Markdown 图片）。
 */
export function normalizeBodyForEditor(body: string): string {
  if (!body?.trim()) return "";

  const hasMdImages = /!\[[^\]]*\]\([^)]+\)/.test(body);
  const looksLikeHtml = body.trimStart().startsWith("<");

  if (looksLikeHtml && !hasMdImages) return body;

  const parts: string[] = [];
  for (const block of body.split(/\n{2,}/)) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    for (const line of trimmed.split("\n")) {
      const lineTrim = line.trim();
      if (!lineTrim) continue;

      const imgMatch = lineTrim.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (imgMatch) {
        parts.push(mdImageToHtml(imgMatch[1], imgMatch[2]));
        continue;
      }

      // 行内可能混有 Markdown 图片
      if (/!\[[^\]]*\]\([^)]+\)/.test(lineTrim)) {
        const converted = lineTrim.replace(
          /!\[([^\]]*)\]\(([^)]+)\)/g,
          (_, alt, src) => mdImageToHtml(alt, src)
        );
        parts.push(converted.includes("<img") ? converted : `<p>${converted}</p>`);
      } else {
        parts.push(`<p>${lineTrim}</p>`);
      }
    }
  }

  return parts.join("");
}

/**
 * 判断 body 是否为"空"：兼容纯文本、Markdown 与 Tiptap 输出的 HTML。
 * 去掉 HTML 标签、实体、空白后若无所剩，且不包含图片/媒体元素，视为空。
 */
export function isEmptyBody(value: string | null | undefined): boolean {
  if (!value) return true;
  if (/<(img|video|audio|iframe)\b/i.test(value) || /!\[[^\]]*\]\([^)]+\)/.test(value)) {
    return false;
  }
  return (
    value
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, "").length === 0
  );
}

export interface ExtractedMediaAttachment {
  id: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

/**
 * 将正文 HTML 与媒体附件卡片数组重新组合为标准带 <img> 标签的完整 HTML 字符串。
 */
export function combineHtmlAndAttachments(
  textHtml: string,
  attachments: ExtractedMediaAttachment[]
): string {
  if (!attachments || attachments.length === 0) {
    return textHtml || "";
  }
  const imgsHtml = attachments
    .map(
      (a) =>
        `<img src="${a.url}"${a.alt ? ` alt="${a.alt.replace(/"/g, "&quot;")}"` : ""} class="orbit-prose-img" />`
    )
    .join("");
  return `${textHtml || ""}${imgsHtml}`;
}


