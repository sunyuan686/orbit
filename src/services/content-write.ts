import { and, eq, isNull } from "drizzle-orm";
import { canEditContent, canDeleteContent } from "../content-policies.js";
import { toPlainText, isEmptyBody } from "../lib/plain-text.js";
import { generateId } from "../lib/id.js";
import {
  authorWriteFields,
  editorWriteFields,
} from "../lib/article-present.js";
import { entry, memo } from "../db/schema.js";
import {
  AuditAction,
  AuditResourceType,
  recordAudit,
} from "./audit.js";
import { getSpaceUserIds } from "./space-authors.js";
import { syncAssetReferences } from "./asset-references.js";
import {
  notifyEntryCreated,
  type NotifyRuntime,
} from "./notify.js";

export type ContentType = "diary" | "timeline" | "message" | "letter" | "memo";

export interface ContentWriteActor {
  userId: string;
  author: string;
}

export interface CreateContentInput {
  type: ContentType;
  title?: string;
  body: string;
  entryDate?: number;
  parentId?: string | null;
  /** Memo unique key; defaults to title or generated key. */
  key?: string;
}

export interface UpdateContentInput {
  id: string;
  title?: string;
  body?: string;
  entryDate?: number;
}

export interface ContentWriteOptions {
  source?: "api" | "ai";
  requestId?: string | null;
  notify?: {
    runtime: NotifyRuntime;
    actorUserId: string;
    actorName: string;
  };
}

export interface ContentWriteResult {
  ok: boolean;
  action: "create" | "update" | "delete";
  id?: string;
  type?: string;
  title?: string | null;
  error?: string;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

async function auditContentWrite(
  db: any,
  actor: ContentWriteActor,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>,
  requestId?: string | null
): Promise<void> {
  await recordAudit(db, {
    userId: actor.userId,
    author: actor.author,
    action,
    resourceType,
    resourceId,
    metadata: {
      ...metadata,
      source: metadata.source ?? "ai",
    },
    requestId: requestId ?? null,
  });
}

export async function createContent(
  db: any,
  actor: ContentWriteActor,
  input: CreateContentInput,
  options: ContentWriteOptions = {}
): Promise<ContentWriteResult> {
  if (isEmptyBody(input.body)) {
    return { ok: false, action: "create", error: "内容不能为空" };
  }

  const source = options.source ?? "ai";

  if (input.type === "memo") {
    const key = input.key?.trim() || input.title?.trim() || `memo-${Date.now()}`;
    const id = generateId("mem");
    const bodyValue = input.body;
    const title = input.title?.trim() || key;

    await db.insert(memo).values({
      id,
      key,
      title,
      body: bodyValue,
      ...authorWriteFields(actor),
      updatedAt: now(),
    });
    await syncAssetReferences(db, "memo", id, bodyValue);
    await auditContentWrite(
      db,
      actor,
      AuditAction.ARTICLE_CREATE,
      AuditResourceType.MEMO,
      id,
      {
        contentType: input.type,
        titleLength: title.length,
        bodyLength: bodyValue.length,
        source,
      },
      options.requestId
    );

    return { ok: true, action: "create", id, type: input.type, title };
  }

  const id = generateId("ent");
  const bodyValue = input.body;
  const title = input.title?.trim() || null;

  await db.insert(entry).values({
    id,
    type: input.type,
    title,
    body: bodyValue,
    bodyText: bodyValue ? toPlainText(bodyValue) : "",
    entryDate: input.entryDate ?? now(),
    parentId: input.parentId ?? null,
    createdAt: now(),
    updatedAt: now(),
    ...authorWriteFields(actor),
  });
  await syncAssetReferences(db, input.type, id, bodyValue);
  await auditContentWrite(
    db,
    actor,
    AuditAction.ARTICLE_CREATE,
    AuditResourceType.ENTRY,
    id,
    {
      contentType: input.type,
      titleLength: title?.length ?? 0,
      bodyLength: bodyValue.length,
      entryDate: input.entryDate ?? null,
      parentId: input.parentId ?? null,
      source,
    },
    options.requestId
  );

  if (options.notify) {
    void notifyEntryCreated(db, options.notify.runtime, {
      actorUserId: options.notify.actorUserId,
      actorName: options.notify.actorName,
      entryId: id,
      entryType: input.type,
      parentId: input.parentId ?? null,
      bodyPreview: bodyValue ? toPlainText(bodyValue) : "",
      requestId: options.requestId ?? null,
    }).catch(() => undefined);
  }

  return { ok: true, action: "create", id, type: input.type, title };
}

export async function updateContent(
  db: any,
  actor: ContentWriteActor,
  input: UpdateContentInput,
  options: ContentWriteOptions = {}
): Promise<ContentWriteResult> {
  if (input.body !== undefined && isEmptyBody(input.body)) {
    return { ok: false, action: "update", id: input.id, error: "内容不能为空" };
  }

  const hasPatch =
    input.title !== undefined ||
    input.body !== undefined ||
    input.entryDate !== undefined;
  if (!hasPatch) {
    return { ok: false, action: "update", id: input.id, error: "未提供任何更新字段" };
  }

  const source = options.source ?? "ai";
  const spaceUserIds = await getSpaceUserIds(db);

  const memoRow = await db
    .select({ id: memo.id, userId: memo.userId, title: memo.title })
    .from(memo)
    .where(and(eq(memo.id, input.id), isNull(memo.deletedAt)))
    .get();

  if (memoRow) {
    if (!canEditContent("memo", memoRow.userId, actor.userId, spaceUserIds)) {
      return { ok: false, action: "update", id: input.id, error: "无权编辑此内容" };
    }

    await db
      .update(memo)
      .set({
        title: input.title ?? undefined,
        body: input.body ?? undefined,
        ...editorWriteFields(actor),
        updatedAt: now(),
      })
      .where(eq(memo.id, input.id));

    if (input.body !== undefined) {
      await syncAssetReferences(db, "memo", input.id, input.body);
    }

    await auditContentWrite(
      db,
      actor,
      AuditAction.ARTICLE_UPDATE,
      AuditResourceType.MEMO,
      input.id,
      {
        titleLength: input.title?.length ?? null,
        bodyLength: input.body?.length ?? null,
        source,
      },
      options.requestId
    );

    return {
      ok: true,
      action: "update",
      id: input.id,
      type: "memo",
      title: input.title ?? memoRow.title,
    };
  }

  const existing = await db
    .select({ type: entry.type, userId: entry.userId, title: entry.title })
    .from(entry)
    .where(and(eq(entry.id, input.id), isNull(entry.deletedAt)))
    .get();

  if (!existing) {
    return { ok: false, action: "update", id: input.id, error: "内容不存在" };
  }

  if (!canEditContent(existing.type, existing.userId, actor.userId, spaceUserIds)) {
    return { ok: false, action: "update", id: input.id, error: "无权编辑此内容" };
  }

  const entryUpdates: Record<string, unknown> = {
    title: input.title ?? undefined,
    entryDate: input.entryDate ?? undefined,
    ...editorWriteFields(actor),
    updatedAt: now(),
  };
  if (input.body !== undefined) {
    entryUpdates.body = input.body;
    entryUpdates.bodyText = input.body ? toPlainText(input.body) : "";
  }

  await db.update(entry).set(entryUpdates).where(eq(entry.id, input.id));
  if (input.body !== undefined) {
    await syncAssetReferences(db, existing.type, input.id, input.body);
  }

  await auditContentWrite(
    db,
    actor,
    AuditAction.ARTICLE_UPDATE,
    AuditResourceType.ENTRY,
    input.id,
    {
      contentType: existing.type,
      titleLength: input.title?.length ?? null,
      bodyLength: input.body?.length ?? null,
      entryDate: input.entryDate ?? null,
      source,
    },
    options.requestId
  );

  return {
    ok: true,
    action: "update",
    id: input.id,
    type: existing.type,
    title: input.title ?? existing.title,
  };
}

export async function deleteContent(
  db: any,
  actor: ContentWriteActor,
  id: string,
  options: ContentWriteOptions = {}
): Promise<ContentWriteResult> {
  const source = options.source ?? "ai";

  const memoRow = await db
    .select({ id: memo.id, userId: memo.userId, title: memo.title })
    .from(memo)
    .where(and(eq(memo.id, id), isNull(memo.deletedAt)))
    .get();

  if (memoRow) {
    if (!canDeleteContent(memoRow.userId, actor.userId)) {
      return { ok: false, action: "delete", id, error: "只能删除自己创建的内容" };
    }

    await db.update(memo).set({ deletedAt: now() }).where(eq(memo.id, id));
    await auditContentWrite(
      db,
      actor,
      AuditAction.ARTICLE_DELETE,
      AuditResourceType.MEMO,
      id,
      { source },
      options.requestId
    );

    return { ok: true, action: "delete", id, type: "memo", title: memoRow.title };
  }

  const entryRow = await db
    .select({
      id: entry.id,
      type: entry.type,
      userId: entry.userId,
      parentId: entry.parentId,
      title: entry.title,
    })
    .from(entry)
    .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
    .get();

  if (!entryRow) {
    return { ok: false, action: "delete", id, error: "内容不存在" };
  }

  if (!canDeleteContent(entryRow.userId, actor.userId)) {
    return { ok: false, action: "delete", id, error: "只能删除自己创建的内容" };
  }

  if (entryRow.type === "letter" && !entryRow.parentId) {
    const reply = await db
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.parentId, id), isNull(entry.deletedAt)))
      .get();
    if (reply) {
      return { ok: false, action: "delete", id, error: "该信件已有回信，无法直接删除" };
    }
  }

  await db.update(entry).set({ deletedAt: now() }).where(eq(entry.id, id));
  await auditContentWrite(
    db,
    actor,
    AuditAction.ARTICLE_DELETE,
    AuditResourceType.ENTRY,
    id,
    { contentType: entryRow.type, source },
    options.requestId
  );

  return {
    ok: true,
    action: "delete",
    id,
    type: entryRow.type,
    title: entryRow.title,
  };
}

export interface WriteContentToolInput {
  action?: "create" | "update" | "delete";
  type?: ContentType;
  id?: string;
  title?: string;
  body?: string;
  entryDate?: number;
  parentId?: string;
  key?: string;
}

export async function executeWriteContentInput(
  db: any,
  actor: ContentWriteActor,
  input: WriteContentToolInput,
  options: ContentWriteOptions = {}
): Promise<ContentWriteResult> {
  const action = input.action;
  if (!action) {
    return { ok: false, action: "create", error: "缺少 action" };
  }

  if (action === "create") {
    if (!input.type) {
      return { ok: false, action, error: "创建内容时必须指定 type" };
    }
    if (!input.body) {
      return { ok: false, action, error: "创建内容时必须提供 body" };
    }
    return createContent(
      db,
      actor,
      {
        type: input.type,
        title: input.title,
        body: input.body,
        entryDate: input.entryDate,
        parentId: input.parentId,
        key: input.key,
      },
      options
    );
  }

  if (action === "update") {
    if (!input.id) {
      return { ok: false, action, error: "更新内容时必须提供 id" };
    }
    return updateContent(
      db,
      actor,
      {
        id: input.id,
        title: input.title,
        body: input.body,
        entryDate: input.entryDate,
      },
      options
    );
  }

  if (!input.id) {
    return { ok: false, action, error: "删除内容时必须提供 id" };
  }
  return deleteContent(db, actor, input.id, options);
}
