import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { httpLogger } from "./logger.js";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

function createRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function getRequestId(c: Context): string | undefined {
  try {
    return c.get("requestId");
  } catch {
    return undefined;
  }
}

export const requestContext = createMiddleware(async (c, next) => {
  const requestId = createRequestId();
  c.set("requestId", requestId);

  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  httpLogger.debug("request.start", { requestId, method, path });

  await next();

  const durationMs = Date.now() - start;
  const status = c.res.status;
  const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

  httpLogger[level]("request.complete", {
    requestId,
    method,
    path,
    status,
    durationMs,
  });
});
