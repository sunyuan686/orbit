/**
 * 从 HTML / Markdown 提取纯文本（第一性原理：字符与状态机单趟扫描解析，严格禁止正则表达式替换）
 */
export function toPlainText(input: string): string {
  if (!input) return "";

  const result: string[] = [];
  const len = input.length;
  let i = 0;
  let isLineStart = true;

  while (i < len) {
    const ch = input[i];

    // 1. HTML 标签解析
    if (ch === "<") {
      const tagEnd = input.indexOf(">", i);
      if (tagEnd === -1) {
        i++;
        continue;
      }

      const tagContent = input.slice(i + 1, tagEnd).trim();
      const lowerTag = tagContent.toLowerCase();

      // 判断音频卡片数据块（第一性原理：跳过整个包含控件的 DOM 容器，仅保留人类语义转写文稿）
      if (lowerTag.includes("data-orbit-audio") || lowerTag.includes("orbit-prose-audio-block")) {
        let transcript = "";
        const attrKeyDouble = 'data-transcript="';
        const attrKeySingle = "data-transcript='";
        let attrIdx = tagContent.indexOf(attrKeyDouble);
        let quoteChar = '"';
        let attrKeyLen = attrKeyDouble.length;
        if (attrIdx === -1) {
          attrIdx = tagContent.indexOf(attrKeySingle);
          quoteChar = "'";
          attrKeyLen = attrKeySingle.length;
        }
        if (attrIdx !== -1) {
          const start = attrIdx + attrKeyLen;
          const end = tagContent.indexOf(quoteChar, start);
          if (end !== -1) {
            transcript = tagContent.slice(start, end);
          }
        }

        // 字符级深度计数状态机：配对外层卡片真正闭合的 </div>，跳过所有内部子元素（波形、0:00、文稿按钮等）
        let depth = 1;
        let p = tagEnd + 1;
        while (p < len && depth > 0) {
          if (input[p] === "<") {
            const nextFive = input.slice(p + 1, p + 6).toLowerCase();
            if (nextFive.startsWith("/div")) {
              const afterDiv = input[p + 5];
              if (afterDiv === ">" || afterDiv === " " || afterDiv === "\t" || afterDiv === "\n") {
                depth--;
                const closeEnd = input.indexOf(">", p);
                if (closeEnd !== -1) {
                  p = closeEnd + 1;
                  if (depth === 0) break;
                  continue;
                }
              }
            } else if (nextFive.startsWith("div")) {
              const afterDiv = input[p + 4];
              if (afterDiv === ">" || afterDiv === " " || afterDiv === "\t" || afterDiv === "\n" || afterDiv === "/") {
                depth++;
                const openEnd = input.indexOf(">", p);
                if (openEnd !== -1) {
                  p = openEnd + 1;
                  continue;
                }
              }
            }
          }
          p++;
        }

        // 若属性中未取到文稿，尝试从内部 <p>...</p> 中提取
        if (!transcript) {
          const pStart = input.indexOf("<p", tagEnd);
          if (pStart !== -1 && pStart < p) {
            const pTextStart = input.indexOf(">", pStart) + 1;
            const pEnd = input.indexOf("</p>", pTextStart);
            if (pEnd !== -1 && pEnd < p) {
              transcript = input.slice(pTextStart, pEnd).trim();
            }
          }
        }

        i = p;
        if (transcript) {
          result.push(" ");
          result.push(transcript);
          result.push(" ");
        }
        isLineStart = false;
        continue;
      }

      // 块级标签终结，追加空格
      if (
        lowerTag.startsWith("/p") ||
        lowerTag.startsWith("/div") ||
        lowerTag.startsWith("br") ||
        lowerTag.startsWith("/h") ||
        lowerTag.startsWith("/li") ||
        lowerTag.startsWith("/blockquote") ||
        lowerTag.startsWith("/tr")
      ) {
        result.push(" ");
        isLineStart = true;
      }

      i = tagEnd + 1;
      continue;
    }

    // 2. 换行与行首重置
    if (ch === "\n" || ch === "\r") {
      result.push(" ");
      isLineStart = true;
      i++;
      continue;
    }

    // 3. 行首 Markdown 元素（标题 #、列表 - / * / 1.、引用 >、分割线 ---）
    if (isLineStart) {
      if (ch === " " || ch === "\t") {
        i++;
        continue;
      }

      // 标题: # 标题
      if (ch === "#") {
        let hCount = 0;
        while (i < len && input[i] === "#") {
          hCount++;
          i++;
        }
        if (hCount <= 6 && (i >= len || input[i] === " " || input[i] === "\t")) {
          while (i < len && (input[i] === " " || input[i] === "\t")) i++;
          isLineStart = false;
          continue;
        }
        result.push("#".repeat(hCount));
        isLineStart = false;
        continue;
      }

      // 引用: > 引用
      if (ch === ">") {
        while (i < len && (input[i] === ">" || input[i] === " " || input[i] === "\t")) i++;
        isLineStart = false;
        continue;
      }

      // 任务列表 / 无序列表: - [x] , - , * , +
      if (
        (ch === "-" || ch === "*" || ch === "+") &&
        i + 1 < len &&
        (input[i + 1] === " " || input[i + 1] === "\t")
      ) {
        // 检查是否为分割线 ---, ***
        let count = 0;
        let p = i;
        while (p < len && (input[p] === ch || input[p] === " " || input[p] === "\t")) {
          if (input[p] === ch) count++;
          p++;
        }
        if (count >= 3 && (p >= len || input[p] === "\n" || input[p] === "\r")) {
          i = p;
          isLineStart = true;
          continue;
        }

        i += 2;
        while (i < len && (input[i] === " " || input[i] === "\t")) i++;
        if (
          i + 3 <= len &&
          input[i] === "[" &&
          (input[i + 1] === " " || input[i + 1] === "x" || input[i + 1] === "X") &&
          input[i + 2] === "]"
        ) {
          i += 3;
          while (i < len && (input[i] === " " || input[i] === "\t")) i++;
        }
        isLineStart = false;
        continue;
      }

      // 有序列表: 1. 2. 10.
      if (ch >= "0" && ch <= "9") {
        let p = i;
        while (p < len && input[p] >= "0" && input[p] <= "9") p++;
        if (
          p < len &&
          (input[p] === "." || input[p] === ")") &&
          (p + 1 >= len || input[p + 1] === " " || input[p + 1] === "\t")
        ) {
          i = p + 1;
          while (i < len && (input[i] === " " || input[i] === "\t")) i++;
          isLineStart = false;
          continue;
        }
      }
    }

    isLineStart = false;

    // 4. 代码块 ``` 或 ~~~
    if (
      (ch === "`" && i + 2 < len && input[i + 1] === "`" && input[i + 2] === "`") ||
      (ch === "~" && i + 2 < len && input[i + 1] === "~" && input[i + 2] === "~")
    ) {
      const fenceChar = ch;
      while (i < len && input[i] === fenceChar) i++;
      while (i < len && input[i] !== "\n" && input[i] !== "\r") i++;
      continue;
    }

    // 5. 图片 ![alt](url)
    if (ch === "!" && i + 1 < len && input[i + 1] === "[") {
      i += 2;
      const bracketClose = input.indexOf("]", i);
      if (bracketClose !== -1) {
        const alt = input.slice(i, bracketClose);
        if (alt) result.push(alt);
        i = bracketClose + 1;
        if (i < len && input[i] === "(") {
          const parenClose = input.indexOf(")", i);
          if (parenClose !== -1) i = parenClose + 1;
        }
        continue;
      }
      result.push("!");
      continue;
    }

    // 6. 链接 [text](url) 或 [text][ref]
    if (ch === "[") {
      const bracketClose = input.indexOf("]", i + 1);
      if (bracketClose !== -1) {
        const text = input.slice(i + 1, bracketClose);
        i = bracketClose + 1;
        if (i < len && input[i] === "(") {
          const parenClose = input.indexOf(")", i);
          if (parenClose !== -1) i = parenClose + 1;
        } else if (i < len && input[i] === "[") {
          const refClose = input.indexOf("]", i);
          if (refClose !== -1) i = refClose + 1;
        }
        result.push(toPlainText(text));
        continue;
      }
    }

    // 7. 粗体、斜体、删除线、高亮、行内代码修饰符
    // 星号 * / ** / ***
    if (ch === "*") {
      while (i < len && input[i] === "*") i++;
      continue;
    }

    // 下划线 _ / __ / ___ (保护标识符内下划线如 user_id)
    if (ch === "_") {
      let count = 0;
      const start = i;
      while (i < len && input[i] === "_") {
        count++;
        i++;
      }
      const prevChar = start > 0 ? input[start - 1] : " ";
      const nextChar = i < len ? input[i] : " ";
      const isWordBoundary = !/[a-zA-Z0-9]/.test(prevChar) || !/[a-zA-Z0-9]/.test(nextChar);
      if (count > 1 || isWordBoundary) {
        continue;
      }
      result.push("_".repeat(count));
      continue;
    }

    // 删除线 ~~
    if (ch === "~" && i + 1 < len && input[i + 1] === "~") {
      i += 2;
      continue;
    }

    // 高亮 ==
    if (ch === "=" && i + 1 < len && input[i + 1] === "=") {
      i += 2;
      continue;
    }

    // 行内代码 `
    if (ch === "`") {
      i++;
      continue;
    }

    // 表格分隔竖线 |
    if (ch === "|") {
      result.push(" ");
      i++;
      continue;
    }

    // 8. HTML 常见实体快速转换
    if (ch === "&") {
      if (input.startsWith("&nbsp;", i)) {
        result.push(" ");
        i += 6;
        continue;
      }
      if (input.startsWith("&amp;", i)) {
        result.push("&");
        i += 5;
        continue;
      }
      if (input.startsWith("&lt;", i)) {
        result.push("<");
        i += 4;
        continue;
      }
      if (input.startsWith("&gt;", i)) {
        result.push(">");
        i += 4;
        continue;
      }
      if (input.startsWith("&quot;", i)) {
        result.push('"');
        i += 6;
        continue;
      }
      if (input.startsWith("&#39;", i) || input.startsWith("&apos;", i)) {
        result.push("'");
        i += input.startsWith("&#39;", i) ? 5 : 6;
        continue;
      }
    }

    result.push(ch);
    i++;
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
