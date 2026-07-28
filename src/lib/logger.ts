export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function resolveMinLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.toLowerCase();
  if (
    configured === "debug" ||
    configured === "info" ||
    configured === "warn" ||
    configured === "error"
  ) {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const minLevel = resolveMinLevel();

function shouldEmit(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[minLevel];
}

function serializeContext(context?: Record<string, unknown>): string {
  if (!context || Object.keys(context).length === 0) {
    return "";
  }
  try {
    return ` ${JSON.stringify(context)}`;
  } catch {
    return " [context-unserializable]";
  }
}

/** Normalize unknown errors for structured logs (Error, AI SDK errors, plain objects). */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const record: Record<string, unknown> = {
      name: err.name,
      message: err.message,
    };
    const extra = err as Error & { chunkType?: string; chunkId?: string };
    if (extra.chunkType) record.chunkType = extra.chunkType;
    if (extra.chunkId) record.chunkId = extra.chunkId;
    if (minLevel === "debug" && err.stack) record.stack = err.stack;
    return record;
  }
  if (typeof err === "object" && err !== null) {
    try {
      return JSON.parse(JSON.stringify(err)) as Record<string, unknown>;
    } catch {
      return { raw: String(err) };
    }
  }
  return { raw: String(err) };
}

function write(
  level: LogLevel,
  module: string,
  message: string,
  context?: Record<string, unknown>
): void {
  if (!shouldEmit(level)) {
    return;
  }
  const prefix = `[${module}]`;
  const suffix = serializeContext(context);
  const line = `${prefix} ${message}${suffix}`;
  switch (level) {
    case "debug":
      console.debug(line);
      break;
    case "info":
      console.info(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "error":
      console.error(line);
      break;
  }
}

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(
    message: string,
    err?: unknown,
    context?: Record<string, unknown>
  ): void;
}

export function createLogger(module: string): Logger {
  return {
    debug(message, context) {
      write("debug", module, message, context);
    },
    info(message, context) {
      write("info", module, message, context);
    },
    warn(message, context) {
      write("warn", module, message, context);
    },
    error(message, err, context) {
      const merged: Record<string, unknown> = { ...context };
      if (err !== undefined) {
        Object.assign(merged, serializeError(err));
      }
      write("error", module, message, merged);
    },
  };
}

export const httpLogger = createLogger("http");
export const auditLogger = createLogger("audit");
