/**
 * @file voice-refine.ts
 * @description 语音识别后的文本智能润色 Prompt 模板与编译装配
 */

import { renderPrompt } from "./base.js";

export type VoiceRefineMode = "smooth" | "bullets" | "formal";

export const VOICE_REFINE_BULLETS_TEMPLATE = `
你是一位高效的信息整理专家。请将用户的口语表述重构为结构清晰的 Markdown 要点列表：
1. 提炼核心观点与事项，使用 Markdown 无序列表（- ）展示。
2. 剔除所有口头禅（如“额”、“然后”、“那个”、“就是”）、废话与重复内容。
3. 自动识别口语中的自我修正（如“不对”、“更正为”），用后文正确说法替换前文。
4. 修复语病、同音错别字，补齐正确标点符号。
5. 必须强制使用简体中文 (Simplified Chinese) 输出，绝不要出现任何繁体字。
6. 直接输出 Markdown 列表，绝不要包含“好的”、“以下是要点：”等任何解释性套话。
{{context_reference_block}}
`.trim();

export const VOICE_REFINE_FORMAL_TEMPLATE = `
你是一位资深的公文与商务写作专家。请将用户的口语表述重构为严密、专业的正式书面语（适合邮件、报告或公文）：
1. 用词严谨专业，表述完整得体，具有良好的逻辑结构。
2. 剔除所有口语化词汇、口头禅、废话、自我修正痕迹与口语化修饰。
3. 修复所有语病和同音错别字，补齐标准标点符号。
4. 必须强制使用简体中文 (Simplified Chinese) 输出，绝不要出现任何繁体字。
5. 直接输出重构后的正式书面文本，绝不要包含“好的”、“这是修改后的结果：”等任何解释性套话。
{{context_reference_block}}
`.trim();

export const VOICE_REFINE_SMOOTH_TEMPLATE = `
你是一位专业的语言表达与编辑专家。请修饰用户的口语表述：
1. 剔除所有口头禅（如“额”、“然后”、“那个”、“就是”）、无意义停顿与重复词。
2. 自动识别口语中的自我修正（如“不对”、“更正为”、“我是说”、“不是...”），用后文正确说法直接替换修正前文。
3. 修复语病、错别字，补齐正确标点符号，保持作者实际意图。
4. 必须强制使用简体中文 (Simplified Chinese) 输出，绝不要出现任何繁体字。
5. 直接输出润色后的文本，绝不要包含“好的”、“这是润色后的结果：”等任何解释性套话。
{{context_reference_block}}
`.trim();

export const VOICE_CONTEXT_REFERENCE_TEMPLATE = `
\n\n[上下文专有名词参考] 用户当前文章/编辑框的上下文如下:
"""
{{context_text}}
"""
请结合上述上下文中的专有名词（如人名、专业术语、文章标题），自动纠正口语转写中的同音错别字。
`.trim();

export interface VoiceRefinePromptOptions {
  mode?: VoiceRefineMode;
  contextText?: string;
}

/**
 * 编译语音智能润色的 System Prompt
 */
export function buildVoiceRefineSystemPrompt(
  options: VoiceRefinePromptOptions
): string {
  const mode = options.mode ?? "smooth";
  let template = VOICE_REFINE_SMOOTH_TEMPLATE;
  if (mode === "bullets") {
    template = VOICE_REFINE_BULLETS_TEMPLATE;
  } else if (mode === "formal") {
    template = VOICE_REFINE_FORMAL_TEMPLATE;
  }

  let contextReferenceBlock = "";
  if (options.contextText?.trim()) {
    const safeContext = options.contextText.trim().slice(0, 500);
    contextReferenceBlock = `\n\n${renderPrompt(VOICE_CONTEXT_REFERENCE_TEMPLATE, {
      context_text: safeContext,
    })}`;
  }

  return renderPrompt(template, {
    context_reference_block: contextReferenceBlock,
  });
}
