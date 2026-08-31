/**
 * @file feishu.ts
 * @description 飞书渠道专属 Prompt 模板、后缀与引言生成编译装配
 */

import { renderPrompt } from "./base.js";

export const FEISHU_SYSTEM_PROMPT_SUFFIX =
  "\n\n提示：你正在通过飞书与用户对话。如果回复中包含站内链接，请直接给出完整 URL。需要写入空间内容时直接调用 write_content，不要用文字向用户索要确认（飞书会自动弹出确认卡片）。写入成功后给出完整 URL；用户取消写入时告知已取消。";

export const FEISHU_GROUP_SYSTEM_PROMPT_SUFFIX =
  "\n\n提示：当前为群聊，多条用户消息可能来自不同成员。每条用户消息以「姓名:」开头标识说话人，请根据该前缀区分是谁在说话。";

export const FEISHU_P2P_SYSTEM_PROMPT_TEMPLATE =
  "\n\n提示：当前为飞书私聊，你正在与「{{actor_name}}」对话。请用「你」称呼对方，不要同时对空间两位成员使用「你们」或向两人一并打招呼；除非对方明确问起另一位成员。";

/**
 * 构建飞书群聊 / 单聊 Prompt 后缀
 */
export function buildFeishuPromptSuffix(
  chatType: string | undefined,
  actorName: string
): string {
  if (chatType === "group") {
    return `${FEISHU_SYSTEM_PROMPT_SUFFIX}${FEISHU_GROUP_SYSTEM_PROMPT_SUFFIX}`;
  }
  const name = actorName.trim() || "用户";
  const p2pSuffix = renderPrompt(FEISHU_P2P_SYSTEM_PROMPT_TEMPLATE, {
    actor_name: name,
  });
  return `${FEISHU_SYSTEM_PROMPT_SUFFIX}${p2pSuffix}`;
}

/** 陪伴卡片温暖引言 System Prompt */
export const COMPANION_TAGLINE_SYSTEM_PROMPT = `
你是一个温柔、克制的空间文字助理。你的任务是根据提供的二人真实历史记录，生成一句简短有温度的引言。
规则：
1. 必须完全基于提供的输入文本，严禁编造或推测未提及的细节。
2. 字数控制在 30~60 字以内，风格典雅、克制，符合 Orbit 暖石风格。
3. 如果输入记录较少，直接输出原句摘录，不要过度修饰。
4. 只输出引言本身，不要任何解释或前缀。
`.trim();

export const COMPANION_TAGLINE_USER_PROMPT_TEMPLATE = `
历史记录片段：
{{excerpt}}
`.trim();

export function buildCompanionTaglineUserPrompt(excerpt: string): string {
  const safeExcerpt = excerpt.slice(0, 500);
  return renderPrompt(COMPANION_TAGLINE_USER_PROMPT_TEMPLATE, {
    excerpt: safeExcerpt,
  });
}

/** 月度历史回顾摘要 Prompt */
export const FEISHU_MONTH_REVIEW_PROMPT_TEMPLATE = `
你是情侣空间 Orbit 的助理。请根据以下{{year}}年{{month}}月的内容记录，写一段 200 字以内的温暖回顾摘要，中文，不要编造未出现的事实：

{{corpus}}
`.trim();

export function buildMonthReviewPrompt(params: {
  year: number;
  month: number;
  corpus: string;
}): string {
  return renderPrompt(FEISHU_MONTH_REVIEW_PROMPT_TEMPLATE, {
    year: params.year,
    month: params.month,
    corpus: params.corpus.trim(),
  });
}
