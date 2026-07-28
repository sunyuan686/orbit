import {
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";

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
  type?: string;
  id?: string;
  title?: string;
  body?: string;
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

export function formatWriteContentApprovalSummary(
  input: WriteContentToolInput
): string {
  const action = ACTION_LABEL[input.action ?? ""] ?? input.action ?? "写入";
  const type = CONTENT_TYPE_LABEL[input.type ?? ""] ?? input.type ?? "";
  const title = input.title?.trim();
  const bodyPreview = input.body?.trim()
    ? input.body.trim().slice(0, 160) +
      (input.body.trim().length > 160 ? "…" : "")
    : "";

  const lines = [`**${action}**${type ? ` · ${type}` : ""}`];
  if (title) lines.push(`标题：${title}`);
  if (input.id) lines.push(`ID：${input.id}`);
  if (bodyPreview) lines.push(`\n> ${bodyPreview}`);
  return lines.join("\n");
}

export function resolveToolApprovalSecret(
  env: Record<string, string | undefined>
): string | undefined {
  return env.TOOL_APPROVAL_SECRET?.trim() || env.BETTER_AUTH_SECRET?.trim();
}
