import {
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { formatWriteContentDateLabel } from "../lib/beijing-date.js";

export const WRITE_CONTENT_APPROVAL_TOOL = "write_content";

const CONTENT_TYPE_LABEL: Record<string, string> = {
  diary: "日记",
  timeline: "时间线",
  message: "留言",
  letter: "信件",
  memo: "备忘录",
};

const ACTION_LABEL: Record<string, string> = {
  create: "创建",
  update: "更新",
  delete: "删除",
};

export interface WriteContentToolInput {
  action?: "create" | "update" | "delete";
  type?: "diary" | "timeline" | "message" | "letter" | "memo";
  id?: string;
  title?: string;
  body?: string;
  date?: string;
  parentId?: string;
  key?: string;
}

const APPROVAL_BODY_PREVIEW_MAX = 1200;

function formatApprovalBodyPreview(body?: string): string | undefined {
  const trimmed = body?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= APPROVAL_BODY_PREVIEW_MAX) return trimmed;
  return `${trimmed.slice(0, APPROVAL_BODY_PREVIEW_MAX)}…`;
}

export function isApprovalContinuation(messages: UIMessage[]): boolean {
  return lastAssistantMessageIsCompleteWithApprovalResponses({ messages });
}

export function getLatestUserMessage(messages: UIMessage[]): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i];
  }
  return null;
}

export function findPendingWriteContentApprovals(
  message: UIMessage | undefined
): Array<{
  approvalId: string;
  toolCallId: string;
  input: WriteContentToolInput;
}> {
  if (!message || message.role !== "assistant") return [];

  return (message.parts ?? [])
    .filter(isToolUIPart)
    .filter(
      (part) =>
        part.type === `tool-${WRITE_CONTENT_APPROVAL_TOOL}` &&
        part.state === "approval-requested" &&
        part.approval?.id
    )
    .map((part) => ({
      approvalId: part.approval!.id,
      toolCallId: part.toolCallId,
      input: (part.input ?? {}) as WriteContentToolInput,
    }));
}

/**
 * AI SDK's addToolApprovalResponse replaces approval with { id, approved, reason }
 * and drops signature. Restore signatures from persisted messages before continuation.
 */
export function restoreToolApprovalSignatures(
  messages: UIMessage[],
  storedMessages: UIMessage[]
): UIMessage[] {
  const signaturesByApprovalId = new Map<string, string>();
  const signaturesByToolCallId = new Map<string, string>();

  for (const message of storedMessages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts ?? []) {
      if (!isToolUIPart(part)) continue;
      const approval = part.approval;
      const signature = approval?.signature;
      if (!signature || !approval) continue;
      if (approval.id) {
        signaturesByApprovalId.set(approval.id, signature);
      }
      if (part.toolCallId) {
        signaturesByToolCallId.set(part.toolCallId, signature);
      }
    }
  }

  if (signaturesByApprovalId.size === 0 && signaturesByToolCallId.size === 0) {
    return messages;
  }

  return messages.map((message) => {
    if (message.role !== "assistant") return message;

    let changed = false;
    const parts = (message.parts ?? []).map((part) => {
      if (!isToolUIPart(part)) return part;
      const approval = part.approval;
      if (!approval) return part;
      if (approval.signature) return part;

      const signature =
        (approval.id ? signaturesByApprovalId.get(approval.id) : undefined) ??
        (part.toolCallId
          ? signaturesByToolCallId.get(part.toolCallId)
          : undefined);

      if (!signature) return part;

      changed = true;
      return {
        ...part,
        approval: { ...approval, signature },
      } as typeof part;
    });

    return changed ? { ...message, parts } : message;
  });
}

export function rejectAllPendingWriteContentApprovals(
  messages: UIMessage[],
  reason: string
): UIMessage[] {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const pending = findPendingWriteContentApprovals(lastAssistant);
  if (pending.length === 0) return messages;

  return pending.reduce(
    (current, item) =>
      applyToolApprovalResponse(current, item.approvalId, false, reason),
    messages
  );
}

export function findApprovedWriteContentToolPart(
  messages: UIMessage[],
  approvalId: string
) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;

    for (const part of message.parts ?? []) {
      if (!isToolUIPart(part)) continue;
      if (part.type !== `tool-${WRITE_CONTENT_APPROVAL_TOOL}`) continue;
      if (part.state !== "approval-responded") continue;
      if (part.approval?.id !== approvalId) continue;
      if (part.approval?.approved !== true) continue;
      return part;
    }
  }

  return null;
}

export function applyWriteContentToolResult(
  messages: UIMessage[],
  approvalId: string,
  output: WriteContentToolOutcome
): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;

    let changed = false;
    const parts = (message.parts ?? []).map((part) => {
      if (!isToolUIPart(part)) return part;
      if (part.type !== `tool-${WRITE_CONTENT_APPROVAL_TOOL}`) return part;
      if (part.approval?.id !== approvalId) return part;
      if (part.state !== "approval-responded") return part;

      changed = true;
      return {
        ...part,
        state: "output-available",
        output,
      } as (typeof message.parts)[number];
    });

    return changed ? { ...message, parts } : message;
  });
}

export function applyToolApprovalResponse(
  messages: UIMessage[],
  approvalId: string,
  approved: boolean,
  reason?: string
): UIMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant") return message;

    let changed = false;
    const parts = (message.parts ?? []).map((part) => {
      if (!isToolUIPart(part)) return part;
      if (part.state !== "approval-requested") return part;
      if (part.approval?.id !== approvalId) return part;

      changed = true;
      return {
        ...part,
        state: "approval-responded" as const,
        approval: {
          ...part.approval,
          approved,
          reason,
        },
      };
    });

    return changed ? { ...message, parts } : message;
  });
}

export interface WriteContentToolOutcome {
  ok: boolean;
  action?: string;
  id?: string;
  type?: string;
  title?: string | null;
  error?: string;
}

const FEISHU_TEXT_APPROVE = new Set([
  "确认",
  "确认写入",
  "同意",
  "写入",
  "ok",
  "yes",
  "y",
]);

const FEISHU_TEXT_DENY = new Set(["取消", "不要", "否", "no", "n"]);

export function parseFeishuTextApprovalDecision(text: string): boolean | null {
  const normalized = text.trim().toLowerCase();
  if (!normalized) return null;
  if (FEISHU_TEXT_APPROVE.has(normalized)) return true;
  if (FEISHU_TEXT_DENY.has(normalized)) return false;
  return null;
}

export function extractWriteContentToolOutcomes(
  message: UIMessage | undefined
): WriteContentToolOutcome[] {
  if (!message || message.role !== "assistant") return [];

  return (message.parts ?? [])
    .filter(isToolUIPart)
    .filter((part) => part.type === `tool-${WRITE_CONTENT_APPROVAL_TOOL}`)
    .filter((part) => part.state === "output-available")
    .map((part) => part.output as WriteContentToolOutcome)
    .filter((output) => output && typeof output === "object");
}

export function formatWriteContentSuccessMessage(
  baseUrl: string,
  outcomes: WriteContentToolOutcome[]
): string | null {
  const successes = outcomes.filter((item) => item.ok && item.id && item.type);
  if (successes.length === 0) return null;

  const root = baseUrl.replace(/\/$/, "");
  return successes
    .map((item) => {
      const label = CONTENT_TYPE_LABEL[item.type!] ?? item.type!;
      const title = item.title?.trim() || label;
      const url = `${root}/${item.type}/${item.id}`;
      const action = ACTION_LABEL[item.action ?? ""] ?? "写入";
      return `✅ **${action}成功** · ${label}\n标题：${title}\n🔗 [在 Orbit 中查看](${url})`;
    })
    .join("\n\n");
}

export function formatWriteContentErrorMessage(
  outcomes: WriteContentToolOutcome[]
): string | null {
  const failures = outcomes.filter((item) => !item.ok);
  if (failures.length === 0) return null;
  return `❌ 写入失败：${failures
    .map((item) => item.error?.trim() || "未知错误")
    .join("；")}`;
}

export function buildWriteContentResultCard(
  baseUrl: string,
  outcome: WriteContentToolOutcome
): Record<string, unknown> {
  if (outcome.ok && outcome.id && outcome.type) {
    const root = baseUrl.replace(/\/$/, "");
    const label = CONTENT_TYPE_LABEL[outcome.type] ?? outcome.type;
    const title = outcome.title?.trim() || label;
    const action = ACTION_LABEL[outcome.action ?? ""] ?? "写入";
    const url = `${root}/${outcome.type}/${outcome.id}`;

    return {
      schema: "2.0",
      header: {
        title: { tag: "plain_text", content: `${action}成功 · ${label}` },
        template: "green",
      },
      body: {
        elements: [
          {
            tag: "markdown",
            content: `✅ 内容已写入 Orbit 空间\n\n**标题：**${title}\n\n🔗 [**在 Orbit 中查看**](${url})`,
          },
        ],
      },
    };
  }

  return {
    schema: "2.0",
    header: {
      title: { tag: "plain_text", content: "写入失败" },
      template: "red",
    },
    body: {
      elements: [
        {
          tag: "markdown",
          content: `❌ ${outcome.error?.trim() || "未知错误"}`,
        },
      ],
    },
  };
}

export function resolveWriteContentFeedbackMessage(
  baseUrl: string,
  message: UIMessage | undefined,
  fallback?: string
): string {
  const outcomes = extractWriteContentToolOutcomes(message);
  return (
    formatWriteContentSuccessMessage(baseUrl, outcomes) ??
    formatWriteContentErrorMessage(outcomes) ??
    fallback?.trim() ??
    ""
  );
}

export function formatWriteContentApprovalSummary(
  input: WriteContentToolInput
): string {
  const action = ACTION_LABEL[input.action ?? ""] ?? input.action ?? "写入";
  const type = CONTENT_TYPE_LABEL[input.type ?? ""] ?? input.type ?? "";
  const title = input.title?.trim();
  const bodyPreview = formatApprovalBodyPreview(input.body);
  const entryDate = formatWriteContentDateLabel(input.date, input.action);
  const isDelete = input.action === "delete";

  const lines: string[] = [
    isDelete
      ? "以下内容将从 Orbit 空间**删除**，请审阅："
      : "以下内容将写入 Orbit 空间，请审阅：",
    "",
    `**${action}**${type ? ` · ${type}` : ""}`,
  ];

  if (input.id) lines.push(`条目 ID：\`${input.id}\``);
  if (title) lines.push(`标题：${title}`);
  if (input.key?.trim()) lines.push(`备忘录 Key：\`${input.key.trim()}\``);
  if (entryDate) lines.push(`日期：${entryDate}`);
  if (input.parentId?.trim()) {
    lines.push(`关联条目：\`${input.parentId.trim()}\``);
  }

  if (bodyPreview) {
    lines.push("", "**正文预览**", `> ${bodyPreview.replace(/\n/g, "\n> ")}`);
  } else if (!isDelete && (input.action === "create" || input.action === "update")) {
    lines.push("", "_（无正文内容）_");
  }

  return lines.join("\n");
}

export function resolveToolApprovalSecret(
  env: Record<string, string | undefined>
): string | undefined {
  return env.TOOL_APPROVAL_SECRET?.trim() || env.BETTER_AUTH_SECRET?.trim();
}
