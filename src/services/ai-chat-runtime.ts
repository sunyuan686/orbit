import {
  convertToModelMessages,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { createLogger } from "../lib/logger.js";
import { readSettingsMap } from "../db/settings-store.js";
import {
  compressMessagesForModel,
  generateAiId,
} from "./ai-chat-store.js";
import { generateHandoffSummary, type HandoffSummaryResult } from "./ai-compaction.js";
import { resolveModel, type AiRuntimeEnv } from "./ai-model.js";
import {
  buildSystemPrompt,
  type AiPromptContext,
} from "./ai-prompt.js";
import { createAiTools } from "./ai-tools.js";
import {
  resolveToolApprovalSecret,
  WRITE_CONTENT_APPROVAL_TOOL,
} from "./ai-tool-approval.js";
import type { ContentWriteActor } from "./content-write.js";
import {
  createAgentLangfuseRecorder,
  traceContextPreparation,
  tracePromptBuild,
  type AgentLangfuseRecorder,
  type AgentRecorderContext,
} from "./ai-agent-tracing.js";
import {
  createLangfuseTrace,
  type ActiveTrace,
  type LangfuseEnv,
} from "./langfuse.js";

const defaultLog = createLogger("ai-chat-runtime");

export interface PrepareAiChatAgentOptions {
  db: any;
  env?: AiRuntimeEnv;
  uiMessages: UIMessage[];
  promptContext: AiPromptContext;
  /** Appended after the shared system prompt (e.g. Feishu channel note). */
  promptSuffix?: string;
  settingsMap?: Record<string, string>;
  /** Actor for content write tools; omit to disable writes. */
  actor?: ContentWriteActor;
  /** When set, records compression / handoff / prompt spans on the trace. */
  trace?: ActiveTrace | null;
}

export interface PreparedAiChatAgent {
  model: Awaited<ReturnType<typeof resolveModel>>["model"];
  provider: string;
  modelId: string;
  system: string;
  tools: ReturnType<typeof createAiTools>;
  modelMessages: ModelMessage[];
  settingsMap: Record<string, string>;
}

export interface BeginAiChatTraceOptions {
  name: string;
  userId: string;
  sessionId: string;
  input: unknown;
  metadata?: Record<string, unknown>;
  tags?: string[];
  env?: LangfuseEnv;
}

export interface AiChatTraceHandles {
  trace: ActiveTrace | null;
  agentRecorder: AgentLangfuseRecorder | null;
  finalized?: boolean;
}

export interface StreamAiChatOptions {
  model: PreparedAiChatAgent["model"];
  system: string;
  messages: ModelMessage[];
  tools: PreparedAiChatAgent["tools"];
  conversationId: string;
  provider: string;
  modelId: string;
  env?: AiRuntimeEnv;
  log?: ReturnType<typeof createLogger>;
  trace?: ActiveTrace | null;
  agentRecorder?: AgentLangfuseRecorder;
  onStepFinish?: Parameters<typeof streamText>[0]["onStepFinish"];
  onToolExecutionStart?: Parameters<typeof streamText>[0]["onToolExecutionStart"];
  onToolExecutionEnd?: Parameters<typeof streamText>[0]["onToolExecutionEnd"];
  onError?: Parameters<typeof streamText>[0]["onError"];
  abortSignal?: AbortSignal;
}

function buildHandoffBridgeMessage(summaryText: string): UIMessage {
  return {
    id: generateAiId("aimsg_bridge"),
    role: "user",
    parts: [
      {
        type: "text",
        text: `[系统上下文交接摘要 / Handoff Summary]\n因为对话较长，早期被截断的历史对话已被自动整理为以下 4 维摘要，请参考这些背景信息回答后续问题：\n\n${summaryText}`,
      },
    ],
  };
}

/**
 * Shared prep for Web / Feishu chat: model, compression, handoff summary,
 * system prompt, tools, and model messages.
 */
export async function prepareAiChatAgent(
  options: PrepareAiChatAgentOptions
): Promise<PreparedAiChatAgent> {
  const settingsMap =
    options.settingsMap ?? (await readSettingsMap(options.db));
  const resolved = await resolveModel(options.db, options.env);

  const originalMessageCount = options.uiMessages.length;
  const { finalMessages, droppedTurns } = compressMessagesForModel(
    options.uiMessages
  );
  let effectiveMessages = finalMessages;
  let handoffSummary: string | null = null;
  let handoffUsage: HandoffSummaryResult["usage"];
  let handoffLlmRequest: unknown;
  let handoffLlmResponse: unknown;

  if (droppedTurns.length > 0) {
    const handoff = await generateHandoffSummary({
      model: resolved.model,
      droppedTurns,
    });
    handoffSummary = handoff?.text ?? null;
    handoffUsage = handoff?.usage;
    handoffLlmRequest = handoff?.llmRequest;
    handoffLlmResponse = handoff?.llmResponse;
    if (handoffSummary) {
      effectiveMessages = [
        buildHandoffBridgeMessage(handoffSummary),
        ...finalMessages,
      ];
    }
  }

  await traceContextPreparation(options.trace ?? null, {
    originalMessageCount,
    finalMessageCount: effectiveMessages.length,
    droppedTurnCount: droppedTurns.length,
    handoffSummary,
    handoffUsage,
    handoffLlmRequest,
    handoffLlmResponse,
    modelId: resolved.modelId,
  });

  const modelMessages = await convertToModelMessages(effectiveMessages);
  let system = await buildSystemPrompt(
    options.db,
    options.promptContext,
    settingsMap
  );
  if (options.promptSuffix) {
    system = `${system}${options.promptSuffix}`;
  }

  const tools = createAiTools(options.db, {
    settingsMap,
    env: (options.env ?? process.env) as Record<string, string>,
    actor: options.actor,
  });

  await tracePromptBuild(options.trace ?? null, {
    contextMode: options.promptContext.mode,
    articleId: options.promptContext.articleId,
    system,
    modelMessages,
    toolNames: Object.keys(tools),
  });

  return {
    model: resolved.model,
    provider: resolved.provider,
    modelId: resolved.modelId,
    system,
    tools,
    modelMessages,
    settingsMap,
  };
}

/** Create the root Langfuse trace. Agent subtree is attached after model prep. */
export function beginAiChatTrace(
  options: BeginAiChatTraceOptions
): AiChatTraceHandles {
  const trace = createLangfuseTrace(
    {
      name: options.name,
      userId: options.userId,
      sessionId: options.sessionId,
      input: options.input,
      metadata: options.metadata,
      tags: options.tags,
    },
    options.env ?? {}
  );

  return {
    trace,
    agentRecorder: null,
  };
}

export function attachAgentLangfuseRecorder(
  handles: AiChatTraceHandles,
  context: AgentRecorderContext
): AgentLangfuseRecorder {
  const recorder = createAgentLangfuseRecorder(handles.trace, context);
  handles.agentRecorder = recorder;
  return recorder;
}

/**
 * Shared streamText defaults for Orbit chat agents.
 * Channel-specific transport (HTTP UI stream vs Feishu CardKit) stays outside.
 */
export function streamAiChat(options: StreamAiChatOptions) {
  const log = options.log ?? defaultLog;
  const startedAt = Date.now();
  const recorder = options.agentRecorder;
  let stepCount = 0;

  const toolApprovalSecret = resolveToolApprovalSecret(
    (options.env ?? process.env) as Record<string, string | undefined>
  );

  return streamText({
    model: options.model,
    system: options.system,
    messages: options.messages,
    tools: options.tools,
    maxRetries: 2,
    ...(options.abortSignal ? { abortSignal: options.abortSignal } : {}),
    include: {
      requestBody: true,
      requestMessages: true,
    },
    toolApproval: {
      [WRITE_CONTENT_APPROVAL_TOOL]: "user-approval",
    },
    ...(toolApprovalSecret
      ? { experimental_toolApprovalSecret: toolApprovalSecret }
      : {}),
    stopWhen: () => false,
    onStepFinish: async (step) => {
      stepCount += 1;
      await recorder?.onStepEnd({
        stepNumber: step.stepNumber,
        text: step.text,
        toolCalls: step.toolCalls.map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: "input" in tc ? tc.input : undefined,
        })),
        toolResults: step.toolResults.map((tr) => ({
          toolCallId: tr.toolCallId,
          toolName: tr.toolName,
          output: "output" in tr ? tr.output : undefined,
        })),
        finishReason: step.finishReason,
        usage: step.usage,
        model: step.model,
        request: {
          messages: step.request.messages,
          body: step.request.body,
        },
        response: {
          messages: step.response.messages,
          body: step.response.body,
        },
      });
      await options.onStepFinish?.(step);
    },
    onToolExecutionStart: (event) => {
      recorder?.onToolExecutionStart({
        toolCall: {
          toolCallId: event.toolCall.toolCallId,
          toolName: event.toolCall.toolName,
          input: "input" in event.toolCall ? event.toolCall.input : undefined,
        },
      });
      options.onToolExecutionStart?.(event);
    },
    onToolExecutionEnd: async (event) => {
      await recorder?.onToolExecutionEnd({
        toolCall: {
          toolCallId: event.toolCall.toolCallId,
          toolName: event.toolCall.toolName,
        },
        toolExecutionMs: event.toolExecutionMs,
        toolOutput: event.toolOutput as any,
      });
      await options.onToolExecutionEnd?.(event);
    },
    onFinish: async () => {
      const traceId = options.trace?.id;
      const traceUrl =
        options.trace?.getUrl() ??
        (traceId
          ? await options.trace?.resolveUrl({ allowApiLookup: true })
          : null);

      log.info("chat finished", {
        conversationId: options.conversationId,
        provider: options.provider,
        modelId: options.modelId,
        durationMs: Date.now() - startedAt,
        stepCount,
        ...(traceId ? { traceId } : {}),
        ...(traceUrl ? { traceUrl } : {}),
      });
    },
    onError: options.onError,
  });
}

/**
 * Finalize the agent subtree and root trace output.
 * Required on Cloudflare Workers / serverless before the isolate exits.
 */
export async function finalizeAiChatTrace(
  handles: AiChatTraceHandles,
  options: {
    output?: unknown;
    error?: unknown;
  } = {}
): Promise<void> {
  if (handles.finalized) {
    await handles.trace?.flush();
    return;
  }
  handles.finalized = true;
  if (handles.agentRecorder) {
    await handles.agentRecorder.finalize(options);
    const traceUrl = await handles.trace?.resolveUrl({ allowApiLookup: true });
    if (handles.trace?.id) {
      defaultLog.info("trace finalized", {
        traceId: handles.trace.id,
        ...(traceUrl ? { traceUrl } : { tracePending: true }),
      });
      if (!traceUrl) {
        defaultLog.warn("trace url not available yet; retry Langfuse UI shortly", {
          traceId: handles.trace.id,
        });
      }
    }
    return;
  }
  if (options.output !== undefined || options.error) {
    await handles.trace?.updateTrace({
      output:
        options.output ??
        String((options.error as any)?.message || options.error),
    });
  }
  await handles.trace?.flush();
}
