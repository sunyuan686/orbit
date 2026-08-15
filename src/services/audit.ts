import { and, desc, eq, gte, sql } from "drizzle-orm";
import { auditLog } from "../db/schema.js";
import { auditLogger } from "../lib/logger.js";

export const AuditAction = {
  ARTICLE_CREATE: "article.create",
  ARTICLE_UPDATE: "article.update",
  ARTICLE_DELETE: "article.delete",
  COMMENT_CREATE: "comment.create",
  COMMENT_UPDATE: "comment.update",
  COMMENT_DELETE: "comment.delete",
  SPACE_UPDATE: "space.update",
  SETTINGS_UPDATE: "settings.update",
} as const;

export type AuditActionValue = (typeof AuditAction)[keyof typeof AuditAction];

export const AuditResourceType = {
  ENTRY: "entry",
  COMMENT: "comment",
  SPACE: "space",
  SETTINGS: "settings",
} as const;

export type AuditResourceTypeValue =
  (typeof AuditResourceType)[keyof typeof AuditResourceType];

export interface RecordAuditInput {
  userId?: string | null;
  author: string;
  action: AuditActionValue | string;
  resourceType: AuditResourceTypeValue | string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
}

export interface AuditLogRow {
  id: string;
  userId: string | null;
  author: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: number;
}

export interface QueryAuditOptions {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  since?: number;
}

function generateAuditId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `aud_${suffix}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function mapAuditRow(row: {
  id: string;
  userId: string | null;
  author: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: string | null;
  requestId: string | null;
  createdAt: number;
}): AuditLogRow {
  return {
    id: row.id,
    userId: row.userId,
    author: row.author,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    metadata: parseMetadata(row.metadata),
    requestId: row.requestId,
    createdAt: row.createdAt,
  };
}

export async function recordAudit(
  db: any,
  input: RecordAuditInput
): Promise<string | null> {
  const id = generateAuditId();
  const metadataJson =
    input.metadata && Object.keys(input.metadata).length > 0
      ? JSON.stringify(input.metadata)
      : null;

  try {
    await db.insert(auditLog).values({
      id,
      userId: input.userId ?? null,
      author: input.author,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      metadata: metadataJson,
      requestId: input.requestId ?? null,
      createdAt: now(),
    });

    auditLogger.info("recorded", {
      id,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      author: input.author,
      requestId: input.requestId ?? null,
    });
    return id;
  } catch (err) {
    auditLogger.error("record failed", err, {
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
    });
    return null;
  }
}

export async function queryAuditLogs(
  db: any,
  options: QueryAuditOptions = {}
): Promise<{ items: AuditLogRow[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const conditions = [];
  if (options.action) {
    conditions.push(eq(auditLog.action, options.action));
  }
  if (options.resourceType) {
    conditions.push(eq(auditLog.resourceType, options.resourceType));
  }
  if (options.resourceId) {
    conditions.push(eq(auditLog.resourceId, options.resourceId));
  }
  if (options.since != null) {
    conditions.push(gte(auditLog.createdAt, options.since));
  }

  const whereClause =
    conditions.length > 0 ? and(...conditions) : undefined;

  const countRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLog)
    .where(whereClause)
    .get();

  const rows = await db
    .select({
      id: auditLog.id,
      userId: auditLog.userId,
      author: auditLog.author,
      action: auditLog.action,
      resourceType: auditLog.resourceType,
      resourceId: auditLog.resourceId,
      metadata: auditLog.metadata,
      requestId: auditLog.requestId,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(whereClause)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map(mapAuditRow),
    total: Number(countRow?.count ?? 0),
  };
}
