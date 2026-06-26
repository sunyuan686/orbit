import {
  sqliteTable,
  text,
  integer,
  index,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";

// ─── better-auth 标准表 ────────────────────────────────────────────────────────

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

/**
 * 核心内容表
 * type: diary（日记事件）| timeline（里程碑）| message（留言板）| letter（信件）
 * parentId: letter 用于关联同轮回信（一封可有多条回信）；message 用于链式回复
 */
export const entry = sqliteTable(
  "entry",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    userId: text("user_id").references(() => user.id),
    /** 创建者署名：小圆子 | 小麟子 */
    author: text("author").notNull().default(""),
    /** 最后编辑者署名 */
    modifiedBy: text("modified_by").notNull().default(""),
    title: text("title"),
    body: text("body"),
    bodyText: text("body_text"),
    entryDate: integer("entry_date"),
    parentId: text("parent_id").references(
      (): AnySQLiteColumn => entry.id
    ),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    check(
      "entry_type_check",
      sql`${t.type} IN ('diary', 'timeline', 'message', 'letter')`
    ),
    index("idx_entry_type_date").on(t.type, t.entryDate),
    index("idx_entry_parent").on(t.parentId),
  ]
);

/**
 * 图片/文件资产表
 * 不存完整 URL，运行时由 storageKey + ASSETS_BASE_URL 拼接
 */
export const asset = sqliteTable("asset", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").references(() => entry.id),
  storageKey: text("storage_key").notNull(),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  width: integer("width"),
  height: integer("height"),
  size: integer("size"),
  position: text("position").notNull().default("a0"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer("deleted_at"),
});

/**
 * 备忘录表（长期维护的活文档，如关于辛芝芝、恋爱原则等）
 * 通过 key 直接访问，不按日期列表
 */
export const memo = sqliteTable("memo", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  body: text("body"),
  /** 创建者署名：小圆子 | 小麟子 */
  author: text("author").notNull().default(""),
  /** 最后编辑者署名 */
  modifiedBy: text("modified_by").notNull().default(""),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer("deleted_at"),
});

/**
 * 评论表
 * kind: bottom（底部评论）| inline（选中评论 / 文本边注）
 * targetType: entry | memo；targetId 对应 entry.id 或 memo.id
 */
export const comment = sqliteTable(
  "comment",
  {
    id: text("id").primaryKey(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    kind: text("kind").notNull(),
    userId: text("user_id").references(() => user.id),
    author: text("author").notNull().default(""),
    body: text("body").notNull(),
    quote: text("quote"),
    anchorFrom: integer("anchor_from"),
    anchorTo: integer("anchor_to"),
    /** 选中文本前面最多 50 个字符，用于位置漂移后消歧 */
    anchorPrefix: text("anchor_prefix"),
    /** 选中文本后面最多 50 个字符，用于位置漂移后消歧 */
    anchorSuffix: text("anchor_suffix"),
    parentId: text("parent_id").references(
      (): AnySQLiteColumn => comment.id
    ),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at")
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    check("comment_target_type_check", sql`${t.targetType} IN ('entry', 'memo')`),
    check("comment_kind_check", sql`${t.kind} IN ('bottom', 'inline')`),
    index("idx_comment_target").on(t.targetType, t.targetId, t.kind),
    index("idx_comment_parent").on(t.parentId),
  ]
);

/**
 * 全局配置表
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 审计日志表
 * action: article.create | article.update | article.delete | comment.* | space.update | settings.update
 * resourceType: entry | memo | comment | space | settings
 */
export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id),
    author: text("author").notNull().default(""),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    metadata: text("metadata"),
    requestId: text("request_id"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_audit_log_created").on(t.createdAt),
    index("idx_audit_log_resource").on(t.resourceType, t.resourceId),
    index("idx_audit_log_action").on(t.action),
  ]
);
