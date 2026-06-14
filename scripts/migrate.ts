import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from "fs";
import { join, extname } from "path";
import { createHash } from "crypto";
import convert from "heic-convert";

const ROOT = join(import.meta.dirname, "..");
const DATA = join(ROOT, "data");
const ASSETS = join(DATA, "assets");

// 源文件
const SOURCE_FILES = [
  "LoveLog.md",
  "留言板.md",
  "信箱.md",
  "恋爱原则.md",
  "关于辛芝芝.md",
];

// ─── 1. 提取所有图片 URL ───
function extractAllImageUrls(files: string[]): string[] {
  const urls = new Set<string>();

  for (const f of files) {
    const content = readFileSync(join(ROOT, f), "utf-8");
    // Markdown: ![...](url)
    for (const m of content.matchAll(/!\[.*?\]\((https:\/\/cdn\.nlark\.com\/[^)]+)\)/g)) {
      urls.add(m[1]);
    }
    // HTML img: <img src="url"...>
    for (const m of content.matchAll(/<img\s+src="(https:\/\/cdn\.nlark\.com\/[^"]+)"/g)) {
      urls.add(m[1]);
    }
  }
  console.log(`[1] 提取到 ${urls.size} 个图片 URL`);
  return [...urls];
}

// ─── 2. 下载所有图片 ───
async function downloadAllImages(
  urls: string[]
): Promise<Map<string, string>> {
  mkdirSync(ASSETS, { recursive: true });
  const urlMap = new Map<string, string>(); // 旧URL → assets/hash.ext
  const failed: string[] = [];
  let downloaded = 0;

  for (const rawUrl of urls) {
    let buf: Buffer | null = null;
    for (let retry = 0; retry < 3; retry++) {
      try {
        const res = await fetch(rawUrl, {
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        buf = Buffer.from(await res.arrayBuffer());
        break;
      } catch {
        if (retry === 2) {
          console.warn(`  ✗ 下载失败: ${rawUrl}`);
          failed.push(rawUrl);
        }
      }
    }
    if (!buf) continue;

    // 获取扩展名（去掉 query 参数）
    const urlPath = new URL(rawUrl).pathname;
    let ext = extname(urlPath).toLowerCase(); // .jpeg, .jpg, .png, .heic 等

    // heic → jpg 转换
    if (ext === ".heic") {
      const result = await convert({ buffer: buf, format: "JPEG", quality: 0.9 });
      buf = Buffer.from(result);
      ext = ".jpg";
    }

    // 统一 .jpeg → .jpg
    if (ext === ".jpeg") ext = ".jpg";

    // SHA256 前 8 位
    const hash = createHash("sha256").update(buf).digest("hex").slice(0, 8);
    const filename = `${hash}${ext}`;
    const filepath = join(ASSETS, filename);

    if (!existsSync(filepath)) {
      writeFileSync(filepath, buf);
    }

    // 映射：同一个 URL 可能出现多次（去重）
    urlMap.set(rawUrl, `assets/${filename}`);
    downloaded++;
    if (downloaded % 20 === 0)
      console.log(`  已下载 ${downloaded}/${urls.length}`);
  }

  console.log(
    `[2] 下载完成: ${downloaded} 张, 失败 ${failed.length} 张`
  );
  if (failed.length > 0) {
    writeFileSync(
      join(ROOT, "migration_failed.txt"),
      failed.join("\n"),
      "utf-8"
    );
  }
  return urlMap;
}

// ─── 3. 拆分 LoveLog.md ───
function splitLoveLog(): { timeline: string; daily: string } {
  const content = readFileSync(join(ROOT, "LoveLog.md"), "utf-8");
  const splitMark = "# 恋爱日志";
  const idx = content.indexOf(splitMark);
  if (idx === -1) throw new Error("找不到 '# 恋爱日志' 分割标记");

  const timeline = content.slice(0, idx).trim();
  const daily = content.slice(idx).trim();
  console.log(`[3] LoveLog.md 拆分完成`);
  return { timeline, daily };
}

// ─── 4. 清洗 Markdown ───
function cleanMarkdown(content: string, urlMap: Map<string, string>): string {
  let s = content;

  // 4.1 替换图片 URL（Markdown 格式）
  s = s.replace(
    /!\[(.*?)\]\((https:\/\/cdn\.nlark\.com\/[^)]+)\)/g,
    (_match, alt, url) => {
      const local = urlMap.get(url);
      return local ? `![${alt}](${local})` : _match;
    }
  );

  // 4.1b 替换 HTML <img> 中的图片 URL 为 Markdown 格式
  s = s.replace(
    /<img\s+src="(https:\/\/cdn\.nlark\.com\/[^"]+)"[^>]*>/g,
    (_match, url) => {
      const local = urlMap.get(url);
      return local ? `![](${local})` : _match;
    }
  );

  // 4.2 去掉 OCR 注释
  s = s.replace(/<!--\s*这是一张图片，ocr 内容为：[^>]*-->\n?/g, "");

  // 4.3 <details> 折叠块展开
  // 多行处理：提取 summary 文本和内部内容
  s = s.replace(
    /<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g,
    (_match, summaryHtml, bodyHtml) => {
      const summaryText = extractText(summaryHtml);
      const bodyText = cleanInnerHtml(bodyHtml);
      return `### ${summaryText}\n\n${bodyText}`;
    }
  );

  // 4.4 <font> 带背景色 → 加粗
  s = s.replace(
    /<font\s+style="background:[^"]*"[^>]*>([\s\S]*?)<\/font>/g,
    "**$1**"
  );
  // 4.4b <font> 纯颜色 → 去掉标签
  s = s.replace(/<font[^>]*>([\s\S]*?)<\/font>/g, "$1");

  // 4.5 语雀提示块 :::warning 等
  s = s.replace(/:::(\w+)\n([\s\S]*?):::/g, (_match, _type, content) => {
    return `> ${content.trim()}`;
  });

  // 4.6 语雀 alert div
  s = s.replace(
    /<div[^>]*class="ne-alert"[^>]*>([\s\S]*?)<\/div>/g,
    (_match, inner) => {
      return `> ${extractText(inner)}`;
    }
  );

  // 4.7 清理残留 HTML
  s = s.replace(/<span[^>]*class="ne-text"[^>]*>([\s\S]*?)<\/span>/g, "$1");
  s = s.replace(/<span[^>]*>([\s\S]*?)<\/span>/g, "$1");
  s = s.replace(/<p[^>]*>/g, "\n");
  s = s.replace(/<\/p>/g, "\n");
  s = s.replace(/<br\s*\/?>/g, "\n");
  s = s.replace(/<hr[^>]*>/g, "---");
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**");
  s = s.replace(/<div[^>]*>([\s\S]*?)<\/div>/g, "$1");
  s = s.replace(/<\/div>/g, "");

  // 4.8 语雀 @mentions 链接 → 纯文本
  s = s.replace(
    /\[@([^\]]+)\]\(https:\/\/www\.yuque\.com\/[^)]+\)/g,
    "@$1"
  );
  // ne-mention 形式
  s = s.replace(
    /<a\s+href="https:\/\/www\.yuque\.com\/[^"]*">@([^<]+)<\/a>/g,
    "@$1"
  );

  // 4.9 语雀卡片占位符
  s = s.replace(
    /\[此处为语雀卡片，点击链接查看\]\([^)]*\)/g,
    ""
  );

  // 4.10 语雀 <blockquote> / <div class="ne-quote">
  s = s.replace(/<blockquote[^>]*>/g, "> ");
  s = s.replace(/<\/blockquote>/g, "");
  s = s.replace(/<div[^>]*class="ne-quote"[^>]*>/g, "");

  // 4.11 清理残留 HTML 标签（通用）
  s = s.replace(/<[^>]+>/g, "");

  // 4.12 修复 HTML 实体
  s = s.replace(/&amp;/g, "&");
  s = s.replace(/&lt;/g, "<");
  s = s.replace(/&gt;/g, ">");
  s = s.replace(/&quot;/g, '"');
  s = s.replace(/&#39;/g, "'");

  // 4.13 清理多余空行（3+ → 2）
  s = s.replace(/\n{3,}/g, "\n\n");

  // 4.14 去掉行首行尾空白
  s = s.trim();

  return s;
}

/** 从 HTML 片段中提取纯文本，保留 Markdown 图片引用 */
function extractText(html: string): string {
  let s = html;
  // 保留图片：<img src="..."> 不删除（已在前面步骤处理）
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** 清理 details 内部 HTML */
function cleanInnerHtml(html: string): string {
  let s = html;
  // 已内嵌的 img 保留 Markdown 格式
  s = s.replace(/<span[^>]*class="ne-text"[^>]*>([\s\S]*?)<\/span>/g, "$1");
  s = s.replace(/<span[^>]*>([\s\S]*?)<\/span>/g, "$1");
  s = s.replace(/<p[^>]*>/g, "\n");
  s = s.replace(/<\/p>/g, "\n");
  s = s.replace(/<br\s*\/?>/g, "\n");
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**");
  // ne-mention
  s = s.replace(
    /<a\s+href="https:\/\/www\.yuque\.com\/[^"]*">@([^<]+)<\/a>/g,
    "@$1"
  );
  // ne-alert inside details
  s = s.replace(/<div[^>]*class="ne-alert"[^>]*>([\s\S]*?)<\/div>/g, "> $1");
  // 残余标签
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

// ─── 5. 添加 frontmatter ───
function addFrontmatter(
  content: string,
  type: string,
  title: string
): string {
  return `---\ntype: ${type}\ntitle: ${title}\n---\n\n${content}`;
}

// ─── 6. 写入目标目录 ───
function writeTarget(
  subdir: string,
  filename: string,
  content: string
): void {
  const dir = join(DATA, subdir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content, "utf-8");
  console.log(`  → data/${subdir}/${filename}`);
}

// ─── 7. 删除源文件 ───
function deleteSourceFiles(): void {
  for (const f of SOURCE_FILES) {
    const p = join(ROOT, f);
    if (existsSync(p)) {
      unlinkSync(p);
      console.log(`  ✗ 已删除 ${f}`);
    }
  }
}

// ─── 8. 校验 ───
function verifySync(): void {
  const dirs = ["journals", "messages", "letters"];
  let cdnCount = 0;
  for (const d of dirs) {
    const dir = join(DATA, d);
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter((f: string) => f.endsWith(".md"));
    for (const f of files) {
      const content = readFileSync(join(dir, f), "utf-8");
      const matches = content.match(/https:\/\/cdn\.nlark\.com/g);
      if (matches) {
        cdnCount += matches.length;
        console.warn(`  ⚠ ${d}/${f} 仍有 ${matches.length} 个 CDN 链接`);
      }
    }
  }
  const assetCount = existsSync(ASSETS) ? readdirSync(ASSETS).length : 0;
  console.log(`[9] 资源统计: ${assetCount} 张图片`);
  if (cdnCount === 0) {
    console.log("[9] ✓ 校验通过：无残留 CDN 链接");
  } else {
    console.warn(`[9] ⚠ 仍有 ${cdnCount} 个 CDN 链接未替换`);
  }
}

// ═══════════════════════════════════
//               主流程
// ═══════════════════════════════════
async function main() {
  console.log("=== Orbit 数据迁移开始 ===\n");

  // 1. 提取图片 URL
  const urls = extractAllImageUrls(SOURCE_FILES);

  // 2. 下载图片（含 heic→jpg）
  const urlMap = await downloadAllImages(urls);

  // 3. 拆分 LoveLog.md
  const { timeline, daily } = splitLoveLog();

  // 4+5+6. 清洗 + frontmatter + 写入
  console.log("[4-7] 清洗 Markdown + 写入目标目录...");

  // LoveLog → journals/timeline.md + journals/daily.md
  const cleanTimeline = cleanMarkdown(timeline, urlMap);
  writeTarget(
    "journals",
    "timeline.md",
    addFrontmatter(cleanTimeline, "journal", "恋爱时间线")
  );

  const cleanDaily = cleanMarkdown(daily, urlMap);
  writeTarget(
    "journals",
    "daily.md",
    addFrontmatter(cleanDaily, "journal", "恋爱日志")
  );

  // 留言板 → messages/
  const msgRaw = readFileSync(join(ROOT, "留言板.md"), "utf-8");
  writeTarget(
    "messages",
    "留言板.md",
    addFrontmatter(cleanMarkdown(msgRaw, urlMap), "message", "留言板")
  );

  // 信箱 → letters/
  const letterRaw = readFileSync(join(ROOT, "信箱.md"), "utf-8");
  writeTarget(
    "letters",
    "信箱.md",
    addFrontmatter(cleanMarkdown(letterRaw, urlMap), "letter", "信箱")
  );

  // 恋爱原则 → journals/
  const rulesRaw = readFileSync(join(ROOT, "恋爱原则.md"), "utf-8");
  writeTarget(
    "journals",
    "恋爱原则.md",
    addFrontmatter(cleanMarkdown(rulesRaw, urlMap), "journal", "恋爱原则")
  );

  // 关于辛芝芝 → journals/
  const aboutRaw = readFileSync(join(ROOT, "关于辛芝芝.md"), "utf-8");
  writeTarget(
    "journals",
    "关于辛芝芝.md",
    addFrontmatter(cleanMarkdown(aboutRaw, urlMap), "journal", "关于辛芝芝")
  );

  // 8. 删除源文件
  console.log("[8] 删除源文件...");
  deleteSourceFiles();

  // 9. 校验
  verifySync();

  console.log("\n=== 迁移完成 ===");
}

main().catch((err) => {
  console.error("迁移失败:", err);
  process.exit(1);
});
