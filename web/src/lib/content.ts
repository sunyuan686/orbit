import { marked } from "marked";

marked.use({
  gfm: true,
  breaks: true,
  renderer: {
    image({ href, title, text }: { href: string; title?: string | null; text?: string }) {
      let url = href || "";
      if (url.startsWith("assets/")) url = `/${url}`;
      const altAttr = text ? ` alt="${text.replace(/"/g, "&quot;")}"` : "";
      const titleAttr = title ? ` title="${title.replace(/"/g, "&quot;")}"` : "";
      return `<img src="${url}"${altAttr}${titleAttr} class="orbit-prose-img" />`;
    },
  },
});

/**
 * 将正文（包括纯 HTML、Markdown 或混合文本）规范化为标准的 TipTap HTML DOM。
 * 遵循 CommonMark / GFM 规范，保留原生 HTML 节点并精准解析 Markdown 标记。
 */
export function normalizeBodyForEditor(body: string): string {
  if (!body?.trim()) return "";
  return marked.parse(body) as string;
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
  mimeType?: string;
  alt?: string;
  width?: number;
  height?: number;
  duration?: number;
  transcript?: string;
}

/**
 * 将正文 HTML 与媒体附件卡片数组重新组合为标准带 <img> / <video> / <audio> 标签的完整 HTML 字符串。
 */
export function combineHtmlAndAttachments(
  textHtml: string,
  attachments: ExtractedMediaAttachment[]
): string {
  if (!attachments || attachments.length === 0) {
    return textHtml || "";
  }
  const mediaHtml = attachments
    .map((a) => {
      if (a.mimeType?.startsWith("video/")) {
        return `<video src="${a.url}" controls class="orbit-prose-video rounded-xl max-w-full my-2" preload="metadata"></video>`;
      }
      if (a.mimeType?.startsWith("audio/")) {
        const heights = [35, 50, 80, 60, 40, 90, 100, 75, 50, 65, 85, 45, 95, 70, 80, 55, 35, 90, 60, 45, 75, 85, 50, 35];
        const waveformBars = heights
          .map((h) => `<span class="orbit-voice-bar w-[3px] rounded-full bg-stone-300 dark:bg-stone-700 transition-colors" style="height:${h}%"></span>`)
          .join("");

        const transcriptToggle = a.transcript
          ? `<button type="button" class="orbit-voice-transcript-toggle flex items-center gap-1 px-2 py-1 rounded-md bg-stone-200/60 dark:bg-stone-800/60 hover:bg-amber-500/10 hover:text-amber-600 text-stone-500 dark:text-stone-400 text-xs font-sans transition-colors cursor-pointer shrink-0 select-none" title="展开/折叠转写文稿"><span class="text-xs select-none">💬</span><span class="text-[10px] font-medium">文稿</span></button>`
          : "";

        const transcriptBlock = a.transcript
          ? `<div class="orbit-voice-transcript-block hidden mt-2 pt-2 border-t border-stone-200/60 dark:border-stone-800/80 text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-normal bg-stone-500/5 dark:bg-stone-400/5 p-2 rounded-lg"><p class="orbit-voice-transcript flex-1 min-w-0 m-0 font-sans">${a.transcript}</p></div>`
          : "";

        return `<div data-orbit-audio="true" data-src="${a.url}" data-transcript="${a.transcript || ""}" class="orbit-prose-audio-block orbit-voice-card group my-2.5 p-2.5 px-3 bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 rounded-xl shadow-xs transition-all hover:border-amber-500/30 select-none max-w-xl"><div class="flex items-center gap-2.5"><button type="button" class="orbit-voice-play-btn w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer" title="播放/暂停"><svg class="w-3.5 h-3.5 fill-current ml-0.5 orbit-voice-play-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg><svg class="w-3.5 h-3.5 fill-current hidden orbit-voice-pause-icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg></button><div class="orbit-voice-waveform flex-1 min-w-0 flex items-center gap-[2.5px] h-4 cursor-pointer py-0.5">${waveformBars}</div><span class="orbit-voice-time text-[11px] font-mono text-stone-500 dark:text-stone-400 shrink-0">0:00</span>${transcriptToggle}</div>${transcriptBlock}<audio src="${a.url}" controls class="orbit-prose-audio hidden"></audio></div>`;
      }
      return `<img src="${a.url}"${a.alt ? ` alt="${a.alt.replace(/"/g, "&quot;")}"` : ""} class="orbit-prose-img" />`;
    })
    .join("");
  return `${textHtml || ""}${mediaHtml}`;
}


