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
 * 在 HTML 中识别连续 >= 3 个 <img> 或 <figure data-image> 节点并规范化聚合为 <figure data-image-deck="true">
 */
export function groupConsecutiveImages(html: string): string {
  if (!html || (!html.includes("<img") && !html.includes("<figure"))) {
    return html;
  }

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const body = doc.body;

      const getImageInfo = (el: Element) => {
        if (el.tagName === "IMG") {
          const img = el as HTMLImageElement;
          return {
            src: img.getAttribute("src") || "",
            alt: img.getAttribute("alt") || "",
            title: img.getAttribute("title") || "",
          };
        }
        if (el.tagName === "FIGURE" && (el.getAttribute("data-image") !== null || el.querySelector("img"))) {
          const img = el.querySelector("img");
          if (!img) return null;
          const figcaption = el.querySelector("figcaption");
          return {
            src: img.getAttribute("src") || "",
            alt: img.getAttribute("alt") || "",
            title: img.getAttribute("title") || "",
            caption: figcaption?.textContent || "",
          };
        }
        if (
          el.tagName === "P" &&
          el.children.length === 1 &&
          el.firstElementChild?.tagName === "IMG" &&
          !el.textContent?.trim()
        ) {
          const img = el.firstElementChild as HTMLImageElement;
          return {
            src: img.getAttribute("src") || "",
            alt: img.getAttribute("alt") || "",
            title: img.getAttribute("title") || "",
          };
        }
        return null;
      };

      const children = Array.from(body.childNodes);
      let currentRun: { node: ChildNode; info: NonNullable<ReturnType<typeof getImageInfo>> }[] = [];

      const flushRun = () => {
        if (currentRun.length >= 3) {
          const deckEl = doc.createElement("figure");
          deckEl.setAttribute("data-image-deck", "true");
          deckEl.setAttribute("data-images", JSON.stringify(currentRun.map((r) => r.info)));

          currentRun[0].node.parentNode?.replaceChild(deckEl, currentRun[0].node);
          for (let i = 1; i < currentRun.length; i++) {
            currentRun[i].node.parentNode?.removeChild(currentRun[i].node);
          }
        }
        currentRun = [];
      };

      for (const node of children) {
        if (node.nodeType === Node.TEXT_NODE) {
          if (!node.textContent?.trim()) {
            continue;
          } else {
            flushRun();
          }
          continue;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.getAttribute("data-image-deck") !== null) {
            flushRun();
            continue;
          }

          const info = getImageInfo(el);
          if (info && info.src) {
            currentRun.push({ node, info });
          } else {
            flushRun();
          }
        } else {
          flushRun();
        }
      }
      flushRun();

      return body.innerHTML;
    } catch {
      return html;
    }
  }

  return html;
}

/**
 * 将正文（包括纯 HTML、Markdown 或混合文本）规范化为标准的 TipTap HTML DOM。
 * 遵循 CommonMark / GFM 规范，保留原生 HTML 节点并精准解析 Markdown 标记，
 * 且对连续 >= 3 张图片进行语义聚合归一。
 */
export function normalizeBodyForEditor(body: string): string {
  if (!body?.trim()) return "";
  const parsed = marked.parse(body) as string;
  return groupConsecutiveImages(parsed);
}

/**
 * 判断 body 是否为"空"：兼容纯文本、Markdown 与 Tiptap 输出的 HTML。
 * 去掉 HTML 标签、实体、空白后若无所剩，且不包含图片/媒体元素，视为空。
 */
export function isEmptyBody(value: string | null | undefined): boolean {
  if (!value) return true;
  if (
    /<(img|video|audio|iframe)\b/i.test(value) ||
    /data-image-deck/i.test(value) ||
    /!\[[^\]]*\]\([^)]+\)/.test(value)
  ) {
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

export type MediaType = "image" | "video" | "audio";

/**
 * 统一推断媒体类型单一可信源：优先根据 mimeType / file.type，兜底根据 URL 或文件名后缀。
 */
export function resolveMediaType(input: {
  mimeType?: string;
  url?: string;
  file?: File;
}): MediaType {
  const mime = (input.mimeType || input.file?.type || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("image/")) return "image";

  const target = (input.url || input.file?.name || "").toLowerCase().split("?")[0];
  if (/\.(mp4|mov|webm|mkv|avi|m4v|ogv)$/.test(target)) return "video";
  if (/\.(mp3|wav|m4a|ogg|aac|flac|opus)$/.test(target)) return "audio";
  return "image";
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
 * 将正文 HTML 与媒体附件卡片数组重新组合为标准带 <img> / <figure data-image-deck> / <video> / <audio> 标签的完整 HTML 字符串。
 */
export function combineHtmlAndAttachments(
  textHtml: string,
  attachments: ExtractedMediaAttachment[]
): string {
  if (!attachments || attachments.length === 0) {
    return textHtml || "";
  }

  const audioAttachments = attachments.filter((a) => resolveMediaType(a) === "audio");
  const videoAttachments = attachments.filter((a) => resolveMediaType(a) === "video");
  const imageAttachments = attachments.filter((a) => resolveMediaType(a) === "image");

  const mediaParts: string[] = [];

  // 1. Audio
  for (const a of audioAttachments) {
    const heights = [35, 50, 80, 60, 40, 90, 100, 75, 50, 65, 85, 45, 95, 70, 80, 55, 35, 90, 60, 45, 75, 85, 50, 35];
    const waveformBars = heights
      .map((h) => `<span class="orbit-voice-bar" style="height:${h}%"></span>`)
      .join("");

    const transcriptToggle = a.transcript
      ? `<button type="button" class="orbit-voice-transcript-toggle" title="展开/折叠转写文稿"><svg class="w-3.5 h-3.5 stroke-current fill-none select-none" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span>文稿</span></button>`
      : "";

    const transcriptBlock = a.transcript
      ? `<div class="orbit-voice-transcript-block hidden"><p class="orbit-voice-transcript m-0 font-sans">${a.transcript}</p></div>`
      : "";

    mediaParts.push(
      `<div data-orbit-audio="true" data-src="${a.url}" data-transcript="${a.transcript || ""}" class="orbit-prose-audio-block orbit-voice-card"><div class="orbit-voice-card-main"><button type="button" class="orbit-voice-play-btn" title="播放/暂停"><svg class="w-3.5 h-3.5 fill-current ml-0.5 orbit-voice-play-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg><svg class="w-3.5 h-3.5 fill-current hidden orbit-voice-pause-icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg></button><div class="orbit-voice-waveform">${waveformBars}</div><span class="orbit-voice-time">0:00</span>${transcriptToggle}</div>${transcriptBlock}<audio src="${a.url}" controls preload="metadata" class="orbit-prose-audio hidden"></audio></div>`
    );
  }

  // 2. Video
  for (const a of videoAttachments) {
    mediaParts.push(
      `<video src="${a.url}" controls class="orbit-prose-video rounded-xl max-w-full my-2" preload="metadata"></video>`
    );
  }

  // 3. Images: if >= 3, output clean data-image-deck block; otherwise single images
  if (imageAttachments.length >= 3) {
    const imagesData = imageAttachments.map((a) => ({
      src: a.url,
      alt: a.alt || "",
      width: a.width,
      height: a.height,
    }));
    mediaParts.push(
      `<figure data-image-deck="true" data-images="${JSON.stringify(imagesData).replace(/"/g, "&quot;")}"></figure>`
    );
  } else {
    for (const a of imageAttachments) {
      mediaParts.push(
        `<img src="${a.url}"${a.alt ? ` alt="${a.alt.replace(/"/g, "&quot;")}"` : ""} class="orbit-prose-img" />`
      );
    }
  }

  return `${textHtml || ""}${mediaParts.join("")}`;
}


