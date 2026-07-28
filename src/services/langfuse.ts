import { Langfuse } from "langfuse";
import { createLogger } from "../lib/logger.js";

const log = createLogger("langfuse");

let cachedProjectId: string | null = null;
let projectIdPromise: Promise<string | null> | null = null;

export interface LangfuseEnv {
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
  LANGFUSE_ENV?: string;
  LANGFUSE_PROJECT_ID?: string;
}

function normalizeLangfuseBaseUrl(env: LangfuseEnv = {}): string {
  return (env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com").replace(
    /\/$/,
    ""
  );
}

function extractProjectIdFromHtmlPath(htmlPath?: string | null): string | null {
  if (!htmlPath) return null;
  const match = htmlPath.match(/^\/project\/([^/]+)\/traces\//);
  return match?.[1] ?? null;
}

export function buildLangfuseTraceUrl(
  env: LangfuseEnv,
  projectId: string,
  traceId: string
): string {
  return `${normalizeLangfuseBaseUrl(env)}/project/${projectId}/traces/${traceId}`;
}

async function resolveLangfuseProjectId(
  lf: Langfuse,
  env: LangfuseEnv
): Promise<string | null> {
  const configured = env.LANGFUSE_PROJECT_ID?.trim();
  if (configured) {
    cachedProjectId = configured;
    return configured;
  }
  if (cachedProjectId) return cachedProjectId;
  if (!projectIdPromise) {
    projectIdPromise = (async () => {
      try {
        const response = await lf.api.traceList({ limit: 1 });
        const projectId = extractProjectIdFromHtmlPath(
          response.data?.[0]?.htmlPath
        );
        if (projectId) {
          cachedProjectId = projectId;
        }
      } catch (err) {
        log.debug("failed to resolve Langfuse project id", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
      return cachedProjectId;
    })();
  }
  return projectIdPromise;
}

function primeLangfuseProjectId(lf: Langfuse, env: LangfuseEnv): void {
  void resolveLangfuseProjectId(lf, env).catch(() => {});
}

async function resolveLangfuseTraceUrl(
  lf: Langfuse,
  env: LangfuseEnv,
  traceId: string,
  options: { allowApiLookup?: boolean } = {}
): Promise<string | null> {
  if (options.allowApiLookup) {
    try {
      const trace = await lf.api.traceGet(traceId);
      if (trace?.htmlPath) {
        const resolvedProjectId = extractProjectIdFromHtmlPath(trace.htmlPath);
        if (resolvedProjectId) {
          cachedProjectId = resolvedProjectId;
        }
        return `${normalizeLangfuseBaseUrl(env)}${trace.htmlPath}`;
      }
    } catch (err) {
      log.debug("failed to resolve Langfuse trace url from API", {
        traceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const projectId = await resolveLangfuseProjectId(lf, env);
  if (projectId) {
    return buildLangfuseTraceUrl(env, projectId, traceId);
  }

  return null;
}

function buildLangfuse(env: LangfuseEnv): Langfuse | null {
  const publicKey = env.LANGFUSE_PUBLIC_KEY?.trim();
  const secretKey = env.LANGFUSE_SECRET_KEY?.trim();
  const baseUrl = env.LANGFUSE_BASE_URL?.trim() || "https://cloud.langfuse.com";

  if (!publicKey || !secretKey) {
    log.info("Langfuse not configured, skipping tracing");
    return null;
  }

  try {
    const instance = new Langfuse({
      publicKey,
      secretKey,
      baseUrl,
      flushAt: 1,
      flushInterval: 500,
    });
    log.info("Langfuse initialized successfully", { baseUrl });
    return instance;
  } catch (err) {
    log.error("Failed to initialize Langfuse client", err);
    return null;
  }
}

export interface TraceContextOptions {
  name: string;
  userId?: string;
  sessionId?: string;
  input?: any;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface StartSpanOptions {
  name: string;
  input?: any;
  metadata?: Record<string, any>;
}

export interface StartGenerationOptions {
  name: string;
  model?: string;
  input?: any;
  metadata?: Record<string, any>;
}

export interface GenerationUsageInput {
  promptTokens?: number;
  completionTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface EndGenerationOptions {
  output?: any;
  usage?: GenerationUsageInput;
  error?: any;
  /** When true, also writes output on the root trace. */
  syncTraceOutput?: boolean;
}

/** Map AI SDK / OpenAI usage fields to Langfuse generation usage. */
export function normalizeGenerationUsage(
  usage?: GenerationUsageInput | null
): EndGenerationOptions["usage"] | undefined {
  if (!usage) return undefined;

  const promptTokens = usage.promptTokens ?? usage.inputTokens;
  const completionTokens = usage.completionTokens ?? usage.outputTokens;
  const totalTokens =
    usage.totalTokens ??
    (promptTokens != null && completionTokens != null
      ? promptTokens + completionTokens
      : undefined);

  if (
    promptTokens == null &&
    completionTokens == null &&
    totalTokens == null
  ) {
    return undefined;
  }

  return { promptTokens, completionTokens, totalTokens };
}

export interface ActiveGeneration {
  end: (options?: EndGenerationOptions) => Promise<void>;
}

export interface ActiveSpan {
  generation: (options: StartGenerationOptions) => ActiveGeneration | null;
  span: (options: StartSpanOptions) => ActiveSpan | null;
  event: (options: {
    name: string;
    input?: any;
    output?: any;
    metadata?: Record<string, any>;
  }) => void;
  update: (data: {
    output?: any;
    metadata?: Record<string, any>;
  }) => Promise<void>;
  end: (data?: {
    output?: any;
    metadata?: Record<string, any>;
  }) => Promise<void>;
}

export interface ActiveTrace extends ActiveSpan {
  id: string;
  getUrl: () => string | null;
  resolveUrl: (options?: { allowApiLookup?: boolean }) => Promise<string | null>;
  updateTrace: (data: {
    output?: any;
    metadata?: Record<string, any>;
    tags?: string[];
  }) => Promise<void>;
  flush: () => Promise<void>;
}

async function flushLangfuse(lf: Langfuse): Promise<void> {
  try {
    await lf.flushAsync();
  } catch (e) {
    log.error("Langfuse flush error", e);
  }
}

function createActiveSpan(
  lf: Langfuse,
  traceId: string,
  parent: { span: (body: any) => any; generation: (body: any) => any; event: (body: any) => any },
  rootTrace: { update: (body: any) => any }
): ActiveSpan {
  return {
    generation(genOptions: StartGenerationOptions): ActiveGeneration | null {
      try {
        const gen = parent.generation({
          name: genOptions.name,
          model: genOptions.model,
          input: genOptions.input,
          metadata: genOptions.metadata,
        });

        return {
          async end(endOptions: EndGenerationOptions = {}) {
            try {
              if (endOptions.error) {
                gen.end({
                  output: endOptions.output ?? String(endOptions.error),
                  statusMessage: String(
                    endOptions.error?.message || endOptions.error
                  ),
                  level: "ERROR",
                  usage: normalizeGenerationUsage(endOptions.usage),
                });
              } else {
                gen.end({
                  output: endOptions.output,
                  usage: normalizeGenerationUsage(endOptions.usage),
                });
              }

              if (endOptions.syncTraceOutput && endOptions.output !== undefined) {
                rootTrace.update({ output: endOptions.output });
              }
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

    span(spanOptions: StartSpanOptions): ActiveSpan | null {
      try {
        const spanClient = parent.span({
          name: spanOptions.name,
          input: spanOptions.input,
          metadata: spanOptions.metadata,
        });
        return createActiveSpan(lf, traceId, spanClient, rootTrace);
      } catch (e) {
        log.error("Failed to create Langfuse span", e);
        return null;
      }
    },

    event(eventOptions) {
      try {
        parent.event({
          name: eventOptions.name,
          input: eventOptions.input,
          output: eventOptions.output,
          metadata: eventOptions.metadata,
        });
      } catch (e) {
        log.error("Failed to create Langfuse event", e);
      }
    },

    async update(data) {
      try {
        if ("update" in parent && typeof parent.update === "function") {
          parent.update(data);
        }
      } catch (e) {
        log.error("Failed to update Langfuse span", e);
      }
    },

    async end(data) {
      try {
        if ("end" in parent && typeof parent.end === "function") {
          parent.end(data);
        }
      } catch (e) {
        log.error("Failed to end Langfuse span", e);
      }
    },
  };
}

/**
 * Creates a Langfuse trace tree. Callers in Workers/serverless MUST await
 * span/generation end + flush before the request isolate exits.
 */
export function createLangfuseTrace(
  options: TraceContextOptions,
  env: LangfuseEnv = {}
): ActiveTrace | null {
  const lf = buildLangfuse(env);
  if (!lf) return null;

  try {
    const environment = env.LANGFUSE_ENV?.trim() || "production";

    const trace = lf.trace({
      name: options.name,
      userId: options.userId,
      sessionId: options.sessionId,
      environment,
      input: options.input,
      metadata: options.metadata,
      tags: options.tags,
    });

    primeLangfuseProjectId(lf, env);
    const traceId = trace.id;
    const traceUrl = cachedProjectId
      ? buildLangfuseTraceUrl(env, cachedProjectId, traceId)
      : env.LANGFUSE_PROJECT_ID?.trim()
        ? buildLangfuseTraceUrl(env, env.LANGFUSE_PROJECT_ID.trim(), traceId)
        : null;

    log.info("trace created", {
      traceId,
      ...(traceUrl ? { traceUrl } : {}),
      name: options.name,
      sessionId: options.sessionId,
      environment,
    });

    const spanApi = createActiveSpan(lf, traceId, trace, trace);

    return {
      ...spanApi,
      id: traceId,

      getUrl() {
        if (cachedProjectId) {
          return buildLangfuseTraceUrl(env, cachedProjectId, traceId);
        }
        const configuredProjectId = env.LANGFUSE_PROJECT_ID?.trim();
        if (configuredProjectId) {
          return buildLangfuseTraceUrl(env, configuredProjectId, traceId);
        }
        return null;
      },

      async resolveUrl(resolveOptions = {}) {
        return resolveLangfuseTraceUrl(lf, env, traceId, resolveOptions);
      },

      async updateTrace(data) {
        try {
          trace.update(data);
        } catch (e) {
          log.error("Failed to update Langfuse trace", e);
        }
      },

      async flush() {
        await flushLangfuse(lf);
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
