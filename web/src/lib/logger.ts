export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const STORAGE_KEY = "orbit:logLevel";

function resolveMinLevel(): LogLevel {
  if (import.meta.env.DEV) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (
        stored === "debug" ||
        stored === "info" ||
        stored === "warn" ||
        stored === "error"
      ) {
        return stored;
      }
    } catch {
      // ignore storage errors
    }
    return "debug";
  }
  return "warn";
}

let minLevel = resolveMinLevel();

export function setClientLogLevel(level: LogLevel): void {
  minLevel = level;
  if (import.meta.env.DEV) {
    try {
      localStorage.setItem(STORAGE_KEY, level);
    } catch {
      // ignore storage errors
    }
  }
}

export function getClientLogLevel(): LogLevel {
  return minLevel;
}

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
      if (err instanceof Error) {
        merged.error = err.message;
        if (err.stack && minLevel === "debug") {
          merged.stack = err.stack;
        }
      } else if (err !== undefined) {
        merged.error = String(err);
      }
      write("error", module, message, merged);
    },
  };
}

export const globalLogger = createLogger("global");
export const routeLogger = createLogger("route");
export const apiLogger = createLogger("api");
export const anchorLogger = createLogger("anchor");
export const marginaliaLogger = createLogger("marginalia");
