import type { LanguageModel } from "ai";

export function isKnownReasoningModel(modelId?: string, provider?: string): boolean {
  if (!modelId) return false;
  const lower = modelId.toLowerCase();
  return (
    lower.includes("qwq") ||
    lower.includes("r1") ||
    lower.includes("reasoner") ||
    lower.includes("thinking")
  );
}

class LanguageModelReasoningParser {
  private mode: "thinking" | "text";
  private pendingBuffer = "";
  private reasoningId = "r0";
  private textId = "t0";
  private hasEmittedReasoningStart = false;
  private hasEmittedTextStart = false;

  constructor(isReasoningModel: boolean) {
    this.mode = isReasoningModel ? "thinking" : "text";
  }

  process(chunk: string): Array<any> {
    const outputs: Array<any> = [];
    let input = this.pendingBuffer + chunk;
    this.pendingBuffer = "";

    while (input.length > 0) {
      if (this.mode === "text") {
        if (!this.hasEmittedTextStart) {
          outputs.push({ type: "text-start", id: this.textId });
          this.hasEmittedTextStart = true;
        }

        const thinkOpenMatch = input.match(/<(?:think(?:ing)?|(?:redacted_)?thinking)>/i);
        if (thinkOpenMatch && thinkOpenMatch.index !== undefined) {
          const textBefore = input.slice(0, thinkOpenMatch.index);
          if (textBefore) {
            outputs.push({
              type: "text-delta",
              id: this.textId,
              delta: textBefore,
              textDelta: textBefore,
            });
          }
          this.mode = "thinking";
          input = input.slice(thinkOpenMatch.index + thinkOpenMatch[0].length);
          continue;
        }

        const partialOpenMatch = input.match(/<(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/i);
        if (partialOpenMatch && partialOpenMatch.index !== undefined && partialOpenMatch.index > 0) {
          const textBefore = input.slice(0, partialOpenMatch.index);
          if (textBefore) {
            outputs.push({
              type: "text-delta",
              id: this.textId,
              delta: textBefore,
              textDelta: textBefore,
            });
          }
          this.pendingBuffer = input.slice(partialOpenMatch.index);
          break;
        }

        outputs.push({
          type: "text-delta",
          id: this.textId,
          delta: input,
          textDelta: input,
        });
        break;
      }

      if (this.mode === "thinking") {
        if (!this.hasEmittedReasoningStart) {
          outputs.push({ type: "reasoning-start", id: this.reasoningId });
          this.hasEmittedReasoningStart = true;
        }

        const thinkCloseMatch = input.match(/<\/(?:think(?:ing)?|(?:redacted_)?thinking)>/i);
        if (thinkCloseMatch && thinkCloseMatch.index !== undefined) {
          const reasoningBefore = input.slice(0, thinkCloseMatch.index);
          if (reasoningBefore) {
            outputs.push({
              type: "reasoning-delta",
              id: this.reasoningId,
              delta: reasoningBefore,
              textDelta: reasoningBefore,
            });
          }
          this.mode = "text";
          input = input.slice(thinkCloseMatch.index + thinkCloseMatch[0].length);
          continue;
        }

        const partialCloseMatch = input.match(/<\/(?:t(?:h(?:i(?:n(?:k(?:i(?:n(?:g)?)?)?)?)?)?)?)?$/i);
        if (partialCloseMatch && partialCloseMatch.index !== undefined && partialCloseMatch.index > 0) {
          const reasoningBefore = input.slice(0, partialCloseMatch.index);
          if (reasoningBefore) {
            outputs.push({
              type: "reasoning-delta",
              id: this.reasoningId,
              delta: reasoningBefore,
              textDelta: reasoningBefore,
            });
          }
          this.pendingBuffer = input.slice(partialCloseMatch.index);
          break;
        }

        outputs.push({
          type: "reasoning-delta",
          id: this.reasoningId,
          delta: input,
          textDelta: input,
        });
        break;
      }
    }

    return outputs;
  }

  flush(): Array<any> {
    if (!this.pendingBuffer) return [];
    const text = this.pendingBuffer;
    this.pendingBuffer = "";
    if (this.mode === "thinking") {
      return [
        ...(this.hasEmittedReasoningStart ? [] : [{ type: "reasoning-start", id: this.reasoningId }]),
        { type: "reasoning-delta", id: this.reasoningId, delta: text, textDelta: text },
      ];
    } else {
      return [
        ...(this.hasEmittedTextStart ? [] : [{ type: "text-start", id: this.textId }]),
        { type: "text-delta", id: this.textId, delta: text, textDelta: text },
      ];
    }
  }
}

function transformReasoningStream(
  stream: ReadableStream<any>,
  isReasoningModel: boolean
): ReadableStream<any> {
  const reader = stream.getReader();
  const parser = new LanguageModelReasoningParser(isReasoningModel);

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const flushed = parser.flush();
          for (const item of flushed) {
            controller.enqueue(item);
          }
          controller.close();
          break;
        }

        if (
          value &&
          typeof value === "object" &&
          value.type === "text-delta" &&
          typeof value.textDelta === "string"
        ) {
          const items = parser.process(value.textDelta);
          for (const item of items) {
            controller.enqueue(item);
          }
        } else {
          controller.enqueue(value);
        }
        break;
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });
}

/**
 * Wraps a LanguageModel to intercept provider stream deltas, converting
 * embedded thinking tokens or QwQ reasoning into standard AI SDK reasoning deltas.
 */
export function wrapReasoningLanguageModel<T extends object>(
  model: T,
  modelId?: string,
  provider?: string
): T {
  if (typeof model !== "object" || model === null) {
    return model;
  }

  const isReasoning = isKnownReasoningModel(modelId, provider);

  return new Proxy(model, {
    get(target, prop, receiver) {
      if (prop === "doStream" && "doStream" in target && typeof (target as any).doStream === "function") {
        return async (...args: any[]) => {
          const result = await (target as any).doStream(...args);
          if (result && result.stream) {
            const transformedStream = transformReasoningStream(result.stream, isReasoning);
            return {
              ...result,
              stream: transformedStream,
            };
          }
          return result;
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
