import type { UIMessage } from "ai";
import {
  applyToolApprovalResponse,
  applyWriteContentToolResult,
  findApprovedWriteContentToolPart,
  resolveWriteContentFeedbackMessage,
  restoreToolApprovalSignatures,
  type WriteContentToolInput,
  type WriteContentToolOutcome,
} from "./ai-tool-approval.js";
import {
  executeWriteContentInput,
  type ContentWriteResult,
} from "./content-write.js";

export type WriteContentApprovalCompletionStatus =
  | "cancelled"
  | "executed"
  | "missing-tool";

export interface WriteContentApprovalActor {
  userId: string;
  author: string;
}

export interface WriteContentApprovalCompletionResult {
  messages: UIMessage[];
  assistantMessage?: UIMessage;
  outcome?: WriteContentToolOutcome;
  feedbackText: string;
  status: WriteContentApprovalCompletionStatus;
}

export const WRITE_CONTENT_APPROVAL_CANCELLED_MESSAGE =
  "已取消写入，未保存任何内容。";

export const WRITE_CONTENT_APPROVAL_MISSING_TOOL_MESSAGE =
  "未找到待写入内容，请重新描述要写入的内容。";

function findLatestAssistantMessage(
  messages: UIMessage[]
): UIMessage | undefined {
  return [...messages].reverse().find((message) => message.role === "assistant");
}

function toWriteContentOutcome(result: ContentWriteResult): WriteContentToolOutcome {
  if (result.ok) {
    return {
      ok: true,
      action: result.action,
      id: result.id,
      type: result.type,
      title: result.title,
    };
  }

  return {
    ok: false,
    action: result.action,
    id: result.id,
    type: result.type,
    title: result.title,
    error: result.error ?? "写入失败",
  };
}

/**
 * Web approval continuation: restore signatures dropped by the client SDK helper.
 */
export function prepareApprovalContinuationMessages(
  incomingMessages: UIMessage[],
  storedMessages: UIMessage[]
): { messages: UIMessage[]; assistantMessage?: UIMessage } {
  const messages = restoreToolApprovalSignatures(incomingMessages, storedMessages);
  return {
    messages,
    assistantMessage: findLatestAssistantMessage(messages),
  };
}

/**
 * Record an approval response on persisted messages (Feishu card / text confirm).
 */
export function recordWriteContentApprovalResponse(
  storedMessages: UIMessage[],
  approvalId: string,
  approved: boolean,
  reason: string
): { messages: UIMessage[]; assistantMessage?: UIMessage } {
  const responded = applyToolApprovalResponse(
    storedMessages,
    approvalId,
    approved,
    reason
  );
  const messages = restoreToolApprovalSignatures(responded, storedMessages);
  return {
    messages,
    assistantMessage: findLatestAssistantMessage(messages),
  };
}

/**
 * Shared post-approval path: persist response, execute write_content, update tool parts.
 * Feishu uses this directly; Web still delegates execution to AI SDK continuation but
 * shares message preparation via prepareApprovalContinuationMessages.
 */
export async function completeWriteContentApproval(options: {
  db: any;
  storedMessages: UIMessage[];
  approvalId: string;
  approved: boolean;
  actor: WriteContentApprovalActor;
  baseUrl: string;
  approvalReasonApproved?: string;
  approvalReasonDenied?: string;
}): Promise<WriteContentApprovalCompletionResult> {
  const { messages: respondedMessages, assistantMessage: respondedAssistant } =
    recordWriteContentApprovalResponse(
      options.storedMessages,
      options.approvalId,
      options.approved,
      options.approved
        ? (options.approvalReasonApproved ?? "用户已确认写入")
        : (options.approvalReasonDenied ?? "用户已取消写入")
    );

  if (!options.approved) {
    return {
      messages: respondedMessages,
      assistantMessage: respondedAssistant,
      feedbackText: WRITE_CONTENT_APPROVAL_CANCELLED_MESSAGE,
      status: "cancelled",
    };
  }

  const approvedToolPart = findApprovedWriteContentToolPart(
    respondedMessages,
    options.approvalId
  );
  if (!approvedToolPart) {
    return {
      messages: respondedMessages,
      assistantMessage: respondedAssistant,
      feedbackText: WRITE_CONTENT_APPROVAL_MISSING_TOOL_MESSAGE,
      status: "missing-tool",
    };
  }

  const writeInput = (approvedToolPart.input ?? {}) as WriteContentToolInput;
  const result = await executeWriteContentInput(options.db, {
    userId: options.actor.userId,
    author: options.actor.author,
  }, writeInput);
  const outcome = toWriteContentOutcome(result);

  const messages = applyWriteContentToolResult(
    respondedMessages,
    options.approvalId,
    outcome
  );
  const assistantMessage = findLatestAssistantMessage(messages);
  const feedbackText =
    resolveWriteContentFeedbackMessage(options.baseUrl, assistantMessage, "") ||
    (outcome.ok ? "✅ 写入成功" : "❌ 写入失败，请稍后再试");

  return {
    messages,
    assistantMessage,
    outcome,
    feedbackText,
    status: "executed",
  };
}
