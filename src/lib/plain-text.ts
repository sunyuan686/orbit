/**
 * 从 HTML / Markdown 提取纯文本（第一性原理：字符与状态机解析，严格禁止正则表达式替换）
 */
export function toPlainText(html: string): string {
  if (!html) return "";

  const result: string[] = [];
  let i = 0;
  const len = html.length;

  while (i < len) {
    if (html[i] === "<") {
      const tagEnd = html.indexOf(">", i);
      if (tagEnd === -1) break;

      const tagContent = html.slice(i + 1, tagEnd).trim();
      const lowerTag = tagContent.toLowerCase();

      // 判断音频卡片数据块
      if (lowerTag.includes("data-orbit-audio") || lowerTag.includes("orbit-prose-audio-block")) {
        let transcript = "";

        // 提取 data-transcript 属性
        const attrKey = 'data-transcript="';
        const attrIdx = tagContent.indexOf(attrKey);
        if (attrIdx !== -1) {
          const start = attrIdx + attrKey.length;
          const end = tagContent.indexOf('"', start);
          if (end !== -1) {
            transcript = tagContent.slice(start, end);
          }
        }

        // 跳过音频组件块内包含的所有标签
        const blockEndIndex = html.indexOf("</div>", tagEnd);
        if (blockEndIndex !== -1) {
          if (!transcript) {
            const transcriptStart = html.indexOf('class="orbit-voice-transcript"', tagEnd);
            if (transcriptStart !== -1 && transcriptStart < blockEndIndex) {
              const textStart = html.indexOf(">", transcriptStart) + 1;
              const textEnd = html.indexOf("</p>", textStart);
              if (textEnd !== -1) {
                transcript = html.slice(textStart, textEnd).trim();
              }
            }
          }
          i = blockEndIndex + 6;
          result.push(transcript ? ` 🎙️ [语音] ${transcript} ` : " 🎙️ [语音] ");
          continue;
        }
      }

      // 如果是块级终结标签，追加空格隔开
      if (lowerTag.startsWith("/p") || lowerTag.startsWith("/div") || lowerTag.startsWith("br")) {
        result.push(" ");
      }

      i = tagEnd + 1;
    } else {
      let textEnd = html.indexOf("<", i);
      if (textEnd === -1) textEnd = len;
      result.push(html.slice(i, textEnd));
      i = textEnd;
    }
  }

  return collapseWhitespace(result.join(""));
}

/** 字符级连续空白与行尾压缩，不依赖正则表达式 */
function collapseWhitespace(str: string): string {
  const parts: string[] = [];
  let inSpace = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (!inSpace) {
        parts.push(" ");
        inSpace = true;
      }
    } else {
      parts.push(ch);
      inSpace = false;
    }
  }

  return parts.join("").trim();
}

/**
 * 判断 body 是否为"空"
 */
export function isEmptyBody(value: string | null | undefined): boolean {
  if (!value) return true;
  if (value.includes("<img") || value.includes("<video") || value.includes("<audio")) {
    return false;
  }
  return collapseWhitespace(toPlainText(value)).length === 0;
}
