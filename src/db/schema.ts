import {
  sqliteTable,
  text,
  integer,
  index,
  check,
  primaryKey,
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
  birthdaySolarMonth: integer("birthday_solar_month"),
  birthdaySolarDay: integer("birthday_solar_day"),
  birthdayLunarMonth: integer("birthday_lunar_month"),
  birthdayLunarDay: integer("birthday_lunar_day"),
  birthdayLunarLeapMonth: integer("birthday_lunar_leap_month", {
    mode: "boolean",
  }).default(false),
  /** solar | lunar；提醒按哪套历法；两侧都空时为 null */
  birthdayRemindCalendar: text("birthday_remind_calendar"),
  /** 个人通知推送偏好（JSON 序列化） */
  notificationPreferences: text("notification_preferences"),
  /** 个人语音转写模式（smooth | raw | bullets | formal） */
  voiceTranscribeMode: text("voice_transcribe_mode").default("smooth"),
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

export const spaceInvite = sqliteTable(
  "space_invite",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
    expiresAt: integer("expires_at").notNull(),
    usedAt: integer("used_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("idx_space_invite_token").on(t.token)]
);

/**
 * 核心内容表
 * type: diary（日记事件）| timeline（里程碑）| message（留言板）| letter（信件）| memo（备忘录）
 * parentId: letter 用于关联同轮回信（一封可有多条回信）；message 用于链式回复
 * status: draft（草稿，仅作者可见）| published（已发布）
 */
export const entry = sqliteTable(
  "entry",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    userId: text("user_id").references(() => user.id),
    author: text("author").notNull().default(""),
    modifiedByUserId: text("modified_by_user_id").references(() => user.id),
    /** 最后编辑者爱称（冗余，与 modified_by_user_id 双写） */
    modifiedBy: text("modified_by").notNull().default(""),
    title: text("title"),
    body: text("body"),
    bodyText: text("body_text"),
    entryDate: integer("entry_date"),
    parentId: text("parent_id").references(
      (): AnySQLiteColumn => entry.id
    ),
    /** 发布状态：draft（草稿）| published（已发布） */
    status: text("status").notNull().default("published"),
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
      "entry_status_check",
      sql`${t.status} IN ('draft', 'published')`
    ),
    index("idx_entry_type_date").on(t.type, t.entryDate),
    index("idx_entry_parent").on(t.parentId),
    index("idx_entry_status_user").on(t.status, t.userId),
  ]
);

/**
 * 图片/文件资产表
 * 不存完整 URL，运行时由 storageKey + ASSETS_BASE_URL 拼接
 */
export const asset = sqliteTable(
  "asset",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id").references(() => entry.id),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull().default("image/jpeg"),
    width: integer("width"),
    height: integer("height"),
    blurhash: text("blurhash"),
    duration: integer("duration"),
    transcript: text("transcript"),
    size: integer("size"),
    position: text("position").notNull().default("a0"),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    index("idx_asset_storage_key").on(t.storageKey),
    index("idx_asset_entry_id").on(t.entryId),
    index("idx_asset_created").on(t.createdAt),
  ]
);

/**
 * 内容正文对图片的引用关系（相册 linked/orphan 与删除保护的事实源）
 * sourceType: entry.type（diary/timeline/memo/...）
 */
export const assetReference = sqliteTable(
  "asset_reference",
  {
    storageKey: text("storage_key").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.storageKey, t.sourceType, t.sourceId] }),
    index("idx_asset_reference_source").on(t.sourceType, t.sourceId),
  ]
);

/**
 * 评论表
 * kind: bottom（底部评论）| inline（选中评论 / 文本边注）
 * targetType: entry；targetId 对应 entry.id
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
    check("comment_target_type_check", sql`${t.targetType} IN ('entry')`),
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

/**
 * AI 聊天会话
 */
export const aiConversation = sqliteTable(
  "ai_conversation",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    contextMode: text("context_mode").notNull(),
    articleId: text("article_id").references(() => entry.id),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    author: text("author").notNull(),
    shared: integer("shared", { mode: "boolean" }).notNull().default(false),
    /** 来源渠道：web | feishu */
    source: text("source").notNull().default("web"),
    lastPreview: text("last_preview").notNull().default(""),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    check(
      "ai_conversation_context_mode_check",
      sql`${t.contextMode} IN ('global', 'article')`
    ),
    check(
      "ai_conversation_source_check",
      sql`${t.source} IN ('web', 'feishu')`
    ),
    index("idx_ai_conversation_user_updated").on(t.userId, t.updatedAt),
    index("idx_ai_conversation_shared").on(t.shared, t.updatedAt),
    index("idx_ai_conversation_article").on(t.articleId),
  ]
);

/**
 * AI 聊天消息（parts JSON 对齐 UIMessage）
 */
/** 飞书入站 message_id 去重（24h TTL，由定时清理或处理时顺带 prune） */
export const feishuMessageDedup = sqliteTable(
  "feishu_message_dedup",
  {
    messageId: text("message_id").primaryKey(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_feishu_message_dedup_created").on(t.createdAt)]
);

/**
 * 飞书 chat → ai_conversation 映射
 * 单聊：p2p:{openId}（话题回复与主窗口共享同一 session）
 * 群聊：group:{chatId}（群内共享上下文）
 */
export const feishuThreadSession = sqliteTable(
  "feishu_thread_session",
  {
    threadKey: text("thread_key").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    lastActiveAt: integer("last_active_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_feishu_thread_session_last_active").on(t.lastActiveAt),
    index("idx_feishu_thread_session_user").on(t.userId),
  ]
);

/**
 * 站内通知（Phase C）
 * type: entry.create | comment.create | letter.reply
 */
export const notification = sqliteTable(
  "notification",
  {
    id: text("id").primaryKey(),
    recipient: text("recipient").notNull(),
    recipientUserId: text("recipient_user_id").references(() => user.id),
    type: text("type").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    actor: text("actor").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id),
    title: text("title").notNull(),
    body: text("body").notNull(),
    link: text("link").notNull(),
    payload: text("payload"),
    readAt: integer("read_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("idx_notification_recipient_read").on(
      t.recipientUserId,
      t.readAt,
      t.createdAt
    ),
    index("idx_notification_merge").on(
      t.recipientUserId,
      t.type,
      t.targetId,
      t.readAt
    ),
  ]
);

/**
 * API Token（Phase B）
 * 仅存 token 哈希；明文仅在创建时返回一次
 */
export const apiToken = sqliteTable(
  "api_token",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    author: text("author").notNull().default(""),
    lastUsedAt: integer("last_used_at"),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("idx_api_token_user").on(t.userId),
    index("idx_api_token_revoked").on(t.revokedAt),
  ]
);

export const aiMessage = sqliteTable(
  "ai_message",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => aiConversation.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    userId: text("user_id").references(() => user.id),
    author: text("author"),
    parts: text("parts").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    check(
      "ai_message_role_check",
      sql`${t.role} IN ('user', 'assistant', 'tool')`
    ),
    index("idx_ai_message_conversation").on(t.conversationId, t.createdAt),
  ]
);

/**
 * 恋爱记忆里程碑解锁（派生规则命中后物化，用于庆祝去重）
 * milestoneKey 见 src/services/love-memories.ts 规则常量
 */
export const milestoneUnlock = sqliteTable(
  "milestone_unlock",
  {
    id: text("id").primaryKey(),
    milestoneKey: text("milestone_key").notNull().unique(),
    unlockedAt: integer("unlocked_at").notNull(),
    celebratedAt: integer("celebrated_at"),
  },
  (t) => [index("idx_milestone_unlock_unlocked").on(t.unlockedAt)]
);

/**
 * 主动陪伴推送记录与去重表
 * type: memory_echo | milestone | digest | weekly_reflection
 * status: sent | skipped | failed
 */
export const companionLog = sqliteTable(
  "companion_log",
  {
    id: text("id").primaryKey(),
    spaceId: text("space_id").notNull(),
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id),
    type: text("type").notNull(),
    /** 关联资源 ID，语义因 type 而异：
     *  memory_echo:       entry_id
     *  milestone:         milestone_key（无单一文章时为 null）
     *  digest:            entry_id（触发推送的 letter/message）
     *  weekly_reflection: null（周维度聚合）
     */
    targetId: text("target_id"),
    payload: text("payload"),
    status: text("status").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    check(
      "companion_log_type_check",
      sql`${t.type} IN ('memory_echo', 'milestone', 'digest', 'weekly_reflection')`
    ),
    check(
      "companion_log_status_check",
      sql`${t.status} IN ('sent', 'skipped', 'failed')`
    ),
    index("idx_companion_dedup").on(t.spaceId, t.recipientUserId, t.targetId, t.createdAt),
    index("idx_companion_log_created").on(t.createdAt),
  ]
);
