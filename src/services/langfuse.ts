import { Langfuse } from "langfuse";
import { createLogger } from "../lib/logger.js";

const log = createLogger("langfuse");

let langfuseInstance: Langfuse | null = null;
let initialized = false;

export function getLangfuse(): Langfuse | null {
  if (initialized) return langfuseInstance;
  initialized = true;

  const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
  const baseUrl = process.env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com";

  if (!publicKey || !secretKey) {
    log.info("Langfuse not configured, skipping tracing");
    langfuseInstance = null;
    return null;
  }

  try {
    langfuseInstance = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      flushAt: 1,
      flushInterval: 500,
    });
    log.info("Langfuse initialized successfully", { baseUrl });
  } catch (err) {
    log.error("Failed to initialize Langfuse client", err);
    langfuseInstance = null;
  }

  return langfuseInstance;
}

export interface TraceContextOptions {
  name: string;
  userId?: string;
  sessionId?: string;
  input?: any;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface StartGenerationOptions {
  name: string;
  model?: string;
  input: any;
  metadata?: Record<string, any>;
}

export interface EndGenerationOptions {
  output?: any;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  error?: any;
}

export interface ActiveGeneration {
  end: (options: EndGenerationOptions) => void;
}

export interface ActiveTrace {
  generation: (options: StartGenerationOptions) => ActiveGeneration | null;
  update: (data: { output?: any; metadata?: Record<string, any>; tags?: string[] }) => void;
}

/**
 * Creates a Langfuse Trace safely and guarantees fast asynchronous flushes.
 */
export function createLangfuseTrace(options: TraceContextOptions): ActiveTrace | null {
  const lf = getLangfuse();
  if (!lf) return null;

  try {
    const environment =
      process.env.LANGFUSE_ENV?.trim() ||
      (process.env.NODE_ENV === "production" ? "production" : "development");

    const trace = lf.trace({
      name: options.name,
      userId: options.userId,
      sessionId: options.sessionId,
      environment,
      input: options.input,
      metadata: options.metadata,
      tags: options.tags,
    });

    return {
      generation(genOptions: StartGenerationOptions): ActiveGeneration | null {
        try {
          const gen = trace.generation({
            name: genOptions.name,
            model: genOptions.model,
            input: genOptions.input,
            metadata: genOptions.metadata,
          });

          return {
            end(endOptions: EndGenerationOptions) {
              try {
                if (endOptions.output) {
                  trace.update({ output: endOptions.output });
                }

                if (endOptions.error) {
                  gen.end({
                    output: endOptions.output ?? String(endOptions.error),
                    statusMessage: String(endOptions.error?.message || endOptions.error),
                    level: "ERROR",
                  });
                } else {
                  gen.end({
                    output: endOptions.output,
                    usage: endOptions.usage
                      ? {
                          promptTokens: endOptions.usage.promptTokens ?? endOptions.usage.inputTokens,
                          completionTokens: endOptions.usage.completionTokens ?? endOptions.usage.outputTokens,
                          totalTokens: endOptions.usage.totalTokens,
                        }
                      : undefined,
                  });
                }
                void lf.flushAsync().catch((e) => log.error("Langfuse flush error", e));
              } catch (e) {
                log.error("Failed to end Langfuse generation", e);
              }
            },
          };
        } catch (e) {
          log.error("Failed to create Langfuse generation", e);
          return null;
        }
      },

      update(data) {
        try {
          trace.update(data);
          void lf.flushAsync().catch((e) => log.error("Langfuse flush error", e));
        } catch (e) {
          log.error("Failed to update Langfuse trace", e);
        }
      },
    };
  } catch (err) {
    log.error("Failed to create Langfuse trace", err);
    return null;
  }
}

export function formatToolsForLangfuse(tools?: Record<string, any>) {
  if (!tools || typeof tools !== "object") return undefined;
  return Object.entries(tools).map(([name, t]) => ({
    name,
    description: (t as any)?.description ?? "",
    parameters: (t as any)?.parameters ?? (t as any)?.schema ?? undefined,
  }));
}
