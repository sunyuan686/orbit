import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

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
 * 核心内容表（日记、留言、信件）
 */
export const entry = sqliteTable("entry", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  author: text("author"),
  title: text("title"),
  body: text("body"),
  entryDate: integer("entry_date"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
  deletedAt: integer("deleted_at"),
});

/**
 * 图片/文件资产表
 */
export const asset = sqliteTable("asset", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").references(() => entry.id),
  storageKey: text("storage_key").notNull(),
  url: text("url").notNull(),
  mimeType: text("mime_type").notNull().default("image/jpeg"),
  width: integer("width"),
  height: integer("height"),
  size: integer("size"),
  createdAt: integer("created_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 备忘录表（长期维护的文档，如关于我们、恋爱原则等）
 */
export const memo = sqliteTable("memo", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  title: text("title").notNull(),
  body: text("body"),
  updatedAt: integer("updated_at")
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 全局配置表
 */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
