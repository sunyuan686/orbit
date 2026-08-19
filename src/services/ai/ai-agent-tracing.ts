import type { ModelMessage } from "ai";
import type { ActiveSpan, ActiveTrace, GenerationUsageInput } from "./langfuse.js";
import { formatToolsForLangfuse } from "./langfuse.js";

type ToolExecutionStartEvent = {
  toolCall: { toolCallId: string; toolName: string; input?: unknown };
};

type ToolExecutionEndEvent = {
  toolCall: { toolCallId: string; toolName: string };
  toolExecutionMs: number;
  toolOutput:
    | { type: "tool-result"; output: unknown }
    | { type: "tool-error"; error: unknown };
};

type AgentStepEvent = {
  stepNumber: number;
  text: string;
  toolCalls: Array<{ toolCallId: string; toolName: string; input?: unknown }>;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    output?: unknown;
  }>;
  finishReason: string;
  usage?: GenerationUsageInput;
  model?: { provider: string; modelId: string };
  request?: {
    messages?: ModelMessage[];
    body?: unknown;
  };
  response?: {
    messages?: ModelMessage[];
    body?: unknown;
  };
};

export interface AgentRecorderContext {
  modelId: string;
  provider?: string;
  system: string;
  tools: Record<string, unknown>;
  /** Initial messages before agent loop; used only if a step omits request.messages. */
  initialMessages: ModelMessage[];
}

export interface AgentLangfuseRecorder {
  agentRunSpan: ActiveSpan | null;
  onStepEnd: (step: AgentStepEvent) => Promise<void>;
  onToolExecutionStart: (event: ToolExecutionStartEvent) => void;
  onToolExecutionEnd: (event: ToolExecutionEndEvent) => Promise<void>;
  finalize: (options: {
    output?: unknown;
    error?: unknown;
  }) => Promise<void>;
}

export interface TraceContextCompactionOptions {
  originalMessageCount: number;
  finalMessageCount: number;
  droppedTurnCount: number;
  handoffSummary?: string | null;
  handoffUsage?: GenerationUsageInput;
  /** Raw provider request body from handoff summary LLM call. */
  handoffLlmRequest?: unknown;
  /** Raw provider response body from handoff summary LLM call. */
  handoffLlmResponse?: unknown;
  modelId?: string;
}

export interface TraceBuildPromptOptions {
  contextMode: string;
  articleId?: string;
  system: string;
  modelMessages: ModelMessage[];
  toolNames: string[];
}

function truncateForTrace(value: unknown, maxLen = 8000): unknown {
  if (typeof value === "string") {
    return value.length <= maxLen ? value : `${value.slice(0, maxLen)}…`;
  }
  try {
    const json = JSON.stringify(value);
    if (json.length <= maxLen) return value;
    return `${json.slice(0, maxLen)}…`;
  } catch {
    return String(value).slice(0, maxLen);
  }
}

function formatModelLabel(model?: { provider: string; modelId: string }, fallback?: string): string | undefined {
  if (model?.modelId) {
    return model.provider ? `${model.provider}/${model.modelId}` : model.modelId;
  }
  return fallback;
}

/** Prefer provider-native HTTP request body; fall back to SDK messages. */
function buildLlmGenerationInput(
  context: AgentRecorderContext,
  step: AgentStepEvent
): unknown {
  if (step.request?.body != null) {
    return truncateForTrace(step.request.body, 48_000);
  }

  if (step.request?.messages?.length) {
    return truncateForTrace(
      {
        messages: step.request.messages,
        ...(context.system ? { system: context.system } : {}),
        tools: formatToolsForLangfuse(context.tools as Record<string, any>),
      },
      24_000
    );
  }

  return truncateForTrace(
    {
      system: context.system,
      messages:
        step.stepNumber === 0 ? context.initialMessages : [],
      tools: formatToolsForLangfuse(context.tools as Record<string, any>),
    },
    24_000
  );
}

/** Prefer provider-native HTTP response body; fall back to SDK response messages. */
function buildLlmGenerationOutput(step: AgentStepEvent): unknown {
  if (step.response?.body != null) {
    return truncateForTrace(step.response.body, 48_000);
  }

  if (step.response?.messages?.length) {
    return truncateForTrace(step.response.messages, 24_000);
  }

  const assistantMessage: Record<string, unknown> = {
    role: "assistant",
    content: step.text || null,
    finishReason: step.finishReason,
  };

  if (step.toolCalls.length > 0) {
    assistantMessage.tool_calls = step.toolCalls.map((tc) => ({
      id: tc.toolCallId,
      type: "function",
      function: {
        name: tc.toolName,
        arguments: JSON.stringify(tc.input ?? {}),
      },
    }));
  }

  return truncateForTrace(assistantMessage, 12_000);
}

/** Record context compression + optional handoff summary on the root trace. */
export async function traceContextPreparation(
  trace: ActiveTrace | null,
  options: TraceContextCompactionOptions
): Promise<void> {
  if (!trace) return;

  const prepareSpan = trace.span({
    name: "prepare-context",
    input: {
      originalMessageCount: options.originalMessageCount,
      finalMessageCount: options.finalMessageCount,
      droppedTurnCount: options.droppedTurnCount,
    },
    metadata: { kind: "chain" },
  });
  if (!prepareSpan) return;

  prepareSpan.event({
    name: "compress-messages",
    metadata: {
      originalMessageCount: options.originalMessageCount,
      finalMessageCount: options.finalMessageCount,
      droppedTurnCount: options.droppedTurnCount,
    },
  });

  if (options.droppedTurnCount > 0) {
    const summaryGen = prepareSpan.generation({
      name: "handoff-summary",
      model: options.modelId,
      input: truncateForTrace(
        options.handoffLlmRequest ?? {
          droppedTurnCount: options.droppedTurnCount,
        }
      ),
      metadata: { kind: "generation" },
    });

    if (options.handoffSummary) {
      await summaryGen?.end({
        output: truncateForTrace(
          options.handoffLlmResponse ?? options.handoffSummary
        ),
        usage: options.handoffUsage,
      });
    } else {
      await summaryGen?.end({
        output: null,
        error: "handoff summary generation returned empty",
      });
    }
  }

  await prepareSpan.end({
    output: {
      finalMessageCount: options.finalMessageCount,
      handoffApplied: Boolean(options.handoffSummary),
    },
  });
}

/** Record system prompt assembly and model message payload shape. */
export async function tracePromptBuild(
  trace: ActiveTrace | null,
  options: TraceBuildPromptOptions
): Promise<void> {
  if (!trace) return;

  const promptSpan = trace.span({
    name: "build-prompt",
    input: {
      contextMode: options.contextMode,
      articleId: options.articleId ?? null,
      messageCount: options.modelMessages.length,
      toolNames: options.toolNames,
    },
    metadata: {
      kind: "chain",
      systemLength: options.system.length,
    },
  });

  await promptSpan?.end({
    output: {
      system: truncateForTrace(options.system, 4000),
      messages: truncateForTrace(options.modelMessages, 12000),
      toolNames: options.toolNames,
    },
  });
}

/**
 * Create per-step / per-tool callbacks for an agent run subtree.
 * Tool nodes use SPAN + metadata.kind=tool because Langfuse v3 ingestion
 * only accepts SPAN | GENERATION | EVENT (native TOOL needs OTel / SDK v5).
 */
export function createAgentLangfuseRecorder(
  trace: ActiveTrace | null,
  context: AgentRecorderContext
): AgentLangfuseRecorder {
  const { modelId: defaultModelId, provider } = context;

  const agentRunSpan = trace?.span({
    name: "agent-run",
    input: { modelId: defaultModelId, provider },
    metadata: { kind: "agent", provider, modelId: defaultModelId },
  }) ?? null;

  const openToolSpans = new Map<
    string,
    { span: ActiveSpan; toolName: string }
  >();
  let stepCount = 0;

  return {
    agentRunSpan,

    async onStepEnd(step) {
      if (!agentRunSpan) return;
      stepCount += 1;

      const stepGen = agentRunSpan.generation({
        name: `llm-call-${step.stepNumber}`,
        model: formatModelLabel(step.model, defaultModelId),
        input: buildLlmGenerationInput(context, step),
        metadata: {
          kind: "generation",
          finishReason: step.finishReason,
          provider: step.model?.provider ?? provider,
          modelId: step.model?.modelId ?? defaultModelId,
        },
      });

      await stepGen?.end({
        output: buildLlmGenerationOutput(step),
        usage: step.usage,
      });
    },

    onToolExecutionStart(event) {
      if (!agentRunSpan) return;

      const toolName = event.toolCall.toolName;
      const toolSpan = agentRunSpan.span({
        name: `tool.${toolName}`,
        input: truncateForTrace(event.toolCall.input),
        metadata: {
          kind: "tool",
          toolName,
          toolCallId: event.toolCall.toolCallId,
        },
      });
      if (toolSpan) {
        openToolSpans.set(event.toolCall.toolCallId, { span: toolSpan, toolName });
      }
    },

    async onToolExecutionEnd(event) {
      const active = openToolSpans.get(event.toolCall.toolCallId);
      if (!active) return;

      openToolSpans.delete(event.toolCall.toolCallId);

      if (event.toolOutput.type === "tool-error") {
        await active.span.end({
          output: truncateForTrace(event.toolOutput.error),
          metadata: {
            kind: "tool",
            toolName: active.toolName,
            durationMs: event.toolExecutionMs,
            status: "error",
          },
        });
        return;
      }

      await active.span.end({
        output: truncateForTrace(event.toolOutput.output),
        metadata: {
          kind: "tool",
          toolName: active.toolName,
          durationMs: event.toolExecutionMs,
          status: "completed",
        },
      });
    },

    async finalize(options) {
      if (options.error) {
        await agentRunSpan?.end({
          output: truncateForTrace(options.output),
          metadata: {
            kind: "agent",
            stepCount,
            status: "error",
            error: String(
              (options.error as any)?.message || options.error
            ),
          },
        });
      } else {
        await agentRunSpan?.end({
          output: truncateForTrace(options.output),
          metadata: {
            kind: "agent",
            stepCount,
            status: "completed",
          },
        });
      }

      if (options.output !== undefined) {
        await trace?.updateTrace({ output: truncateForTrace(options.output) });
      } else if (options.error) {
        await trace?.updateTrace({
          output: String((options.error as any)?.message || options.error),
        });
      }

      await trace?.flush();
    },
  };
}

export function chainAsync<T extends (...args: any[]) => any>(
  handlers: Array<T | undefined>
): T {
  return (async (...args: Parameters<T>) => {
    for (const handler of handlers) {
      if (handler) {
        await handler(...args);
      }
    }
  }) as T;
}
