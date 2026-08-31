/**
 * @file base.ts
 * @description 提示词底座与通用编译渲染工具（Mustache 占位符与 XML 语义边界）
 */

/** 全局通用语言规范 */
export const BASE_LANGUAGE_RULE =
  "必须强制使用简体中文 (Simplified Chinese) 输出，绝不要出现任何繁体字。";

/**
 * 统一模板渲染器：将 {{placeholder}} 安全替换为 variables 中的变量值
 * 1. 自动安全转换字符串并清洗两端空白
 * 2. 如果变量为 null/undefined，自动替换为空字符串
 */
export function renderPrompt(
  template: string,
  variables: Record<string, string | number | boolean | undefined | null>
): string {
  return template
    .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
      const value = variables[key];
      if (value === undefined || value === null) {
        return "";
      }
      return String(value).trim();
    })
    .trim();
}

export interface BuildXmlBlockOptions {
  /** 字符上限，超出时自动截断并追加省略号 */
  maxChars?: number;
}

/**
 * 构建规范的 XML 块。
 * 若内容为空或全为空白，则直接返回空字符串（避免向模型输出无效空标签）。
 */
export function buildXmlBlock(
  tag: string,
  content: string | undefined | null,
  options?: BuildXmlBlockOptions
): string {
  if (!content) return "";
  let text = content.trim();
  if (!text) return "";

  if (options?.maxChars && text.length > options.maxChars) {
    text = `${text.slice(0, options.maxChars)}…`;
  }

  return `<${tag}>\n${text}\n</${tag}>`;
}
