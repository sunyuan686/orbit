import { readSettingsMap } from "../db/settings-store.js";
/**
 * 主动陪伴引擎 (Companion Engine)
 *
 * 负责：契机扫描 → 评分过滤 → 场景优先级排序 → 去重校验 → 交给 feishu-companion-card 投递
 *
 * 调度入口：worker.ts scheduled handler（每小时触发，Worker 内部按用户时区判断投递窗口）
 */

import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import { companionLog, entry, milestoneUnlock } from "../db/schema.js";
import { getSpaceAuthors } from "./space-authors.js";
import { beijingTodayKey, addBeijingDays, beijingStartOfDayUnix, beijingEndOfDayUnix } from "../lib/beijing-date.js";
import { generateId } from "../lib/id.js";

// ─── 常量 ─────────────────────────────────────────────────────────────────────

/** 候选评分门槛 */
const SCORE_THRESHOLD = 50;

/** 每日每用户最多推送条数 */
const DAILY_QUOTA = 1;

/** Memory Echo 去重窗口（天） */
const MEMORY_ECHO_DEDUP_DAYS = 30;

/** 安静时段：22:30 ~ 08:30（北京时间，小时*60+分钟） */
const QUIET_START_MINUTES = 22 * 60 + 30;
const QUIET_END_MINUTES = 8 * 60 + 30;

/** Weekly Reflection 最少记录条数 */
const WEEKLY_REFLECTION_MIN_ENTRIES = 3;

/** Weekly Reflection 最少总字数 */
const WEEKLY_REFLECTION_MIN_CHARS = 500;

// ─── 类型 ─────────────────────────────────────────────────────────────────────

export type CompanionType = "memory_echo" | "milestone" | "digest" | "weekly_reflection";
export type CompanionStatus = "sent" | "skipped" | "failed";

/** 场景优先级：数字越小优先级越高 */
const SCENE_PRIORITY: Record<CompanionType, number> = {
  milestone: 0,
  memory_echo: 1,
  weekly_reflection: 2,
  digest: 3,
};

export interface CompanionCandidate {
  type: CompanionType;
  recipientUserId: string;
  targetId: string | null;
  score: number;
  /** 给卡片构建器用的上下文数据 */
  context: Record<string, unknown>;
}

export interface CompanionEngineResult {
  dispatched: CompanionCandidate[];
  skipped: CompanionCandidate[];
}

// ─── 时区工具 ─────────────────────────────────────────────────────────────────

/** 返回当前北京时间在一天中的分钟数（0~1439） */
function beijingCurrentMinutes(nowTs = Math.floor(Date.now() / 1000)): number {
  const BEIJING_OFFSET_SECONDS = 8 * 3600;
  const d = new Date((nowTs + BEIJING_OFFSET_SECONDS) * 1000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** 是否处于安静时段 */
export function isQuietHours(nowTs = Math.floor(Date.now() / 1000)): boolean {
  const m = beijingCurrentMinutes(nowTs);
  // 跨午夜：22:30 ~ 次日 08:30
  if (QUIET_START_MINUTES > QUIET_END_MINUTES) {
    return m >= QUIET_START_MINUTES || m < QUIET_END_MINUTES;
  }
  return m >= QUIET_START_MINUTES && m < QUIET_END_MINUTES;
}

/** 是否在指定时间窗内（[startH, startM] ~ [endH, endM]，北京时间） */
function isInTimeWindow(startH: number, startM: number, endH: number, endM: number, nowTs?: number): boolean {
  const m = beijingCurrentMinutes(nowTs);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  return m >= start && m < end;
}

// ─── 去重 / Quota 检查 ────────────────────────────────────────────────────────

/** 今日该用户是否已发过推送 */
async function hasDailyQuota(db: any, recipientUserId: string, nowTs: number): Promise<boolean> {
  const todayKey = beijingTodayKey(nowTs);
  const dayStart = beijingStartOfDayUnix(todayKey);
  const dayEnd = beijingEndOfDayUnix(todayKey);

  const row = await db
    .select({ id: companionLog.id })
    .from(companionLog)
    .where(
      and(
        eq(companionLog.recipientUserId, recipientUserId),
        eq(companionLog.status, "sent"),
        gte(companionLog.createdAt, dayStart),
        sql`${companionLog.createdAt} <= ${dayEnd}`
      )
    )
    .limit(1)
    .get();
  return Boolean(row);
}

/** 某 targetId 是否在最近 N 天内推过（用于 memory_echo 去重） */
async function wasRecentlyPushed(
  db: any,
  recipientUserId: string,
  targetId: string,
  days: number,
  nowTs: number
): Promise<boolean> {
  const cutoff = nowTs - days * 86400;
  const row = await db
    .select({ id: companionLog.id })
    .from(companionLog)
    .where(
      and(
        eq(companionLog.recipientUserId, recipientUserId),
        eq(companionLog.targetId, targetId),
        eq(companionLog.type, "memory_echo"),
        eq(companionLog.status, "sent"),
        gte(companionLog.createdAt, cutoff)
      )
    )
    .limit(1)
    .get();
  return Boolean(row);
}

// ─── 写入 companion_log ───────────────────────────────────────────────────────

export async function writeCompanionLog(
  db: any,
  candidate: CompanionCandidate,
  status: CompanionStatus,
  nowTs: number
): Promise<string> {
  const id = generateId("cmp");
  await db.insert(companionLog).values({
    id,
    spaceId: "default",
    recipientUserId: candidate.recipientUserId,
    type: candidate.type,
    targetId: candidate.targetId,
    payload: JSON.stringify(candidate.context),
    status,
    createdAt: nowTs,
  });
  return id;
}

// ─── 场景一：Memory Echo ──────────────────────────────────────────────────────

async function scanMemoryEcho(
  db: any,
  recipientUserId: string,
  nowTs: number
): Promise<CompanionCandidate[]> {
  const todayKey = beijingTodayKey(nowTs);

  // 去年的今天 / 半年前的今天
  const anchors = [
    addBeijingDays(todayKey, -365),
    addBeijingDays(todayKey, -183),
  ];

  const candidates: CompanionCandidate[] = [];

  for (const anchor of anchors) {
    const dayStart = beijingStartOfDayUnix(anchor);
    const dayEnd = beijingEndOfDayUnix(anchor);

    const rows = await db
      .select({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        bodyText: entry.bodyText,
        entryDate: entry.entryDate,
      })
      .from(entry)
      .where(
        and(
          isNull(entry.deletedAt),
          gte(entry.entryDate, dayStart),
          sql`${entry.entryDate} <= ${dayEnd}`,
          sql`${entry.type} IN ('diary', 'timeline', 'letter')`
        )
      )
      .orderBy(desc(entry.createdAt))
      .limit(5);

    for (const row of rows) {
      let score = 50; // 去年/半年前的今天基础分
      const bodyLen = (row.bodyText ?? "").length;
      if (bodyLen > 300) score += 10;

      // 检查去重
      const recentlyPushed = await wasRecentlyPushed(db, recipientUserId, row.id, MEMORY_ECHO_DEDUP_DAYS, nowTs);
      if (recentlyPushed) continue; // -100 直接排除

      if (score >= SCORE_THRESHOLD) {
        candidates.push({
          type: "memory_echo",
          recipientUserId,
          targetId: row.id,
          score,
          context: {
            entryId: row.id,
            entryType: row.type,
            title: row.title ?? "",
            excerpt: (row.bodyText ?? "").slice(0, 200),
            anchorKey: anchor,
          },
        });
      }
    }
  }

  // 若去年的今天/半年前的今天没有匹配，随机精选一条 30 天以前的高分旧记忆
  if (candidates.length === 0) {
    const thirtyDaysAgoTs = nowTs - 30 * 86400;
    const randomRows = await db
      .select({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        bodyText: entry.bodyText,
        entryDate: entry.entryDate,
      })
      .from(entry)
      .where(
        and(
          isNull(entry.deletedAt),
          sql`${entry.entryDate} <= ${thirtyDaysAgoTs}`,
          sql`${entry.type} IN ('diary', 'timeline', 'letter')`,
          sql`length(coalesce(${entry.bodyText}, '')) > 100`
        )
      )
      .orderBy(sql`RANDOM()`)
      .limit(5);

    for (const row of randomRows) {
      const recentlyPushed = await wasRecentlyPushed(db, recipientUserId, row.id, MEMORY_ECHO_DEDUP_DAYS, nowTs);
      if (recentlyPushed) continue;

      let score = 50;
      if ((row.bodyText ?? "").length > 300) score += 10;

      if (score >= SCORE_THRESHOLD) {
        candidates.push({
          type: "memory_echo",
          recipientUserId,
          targetId: row.id,
          score,
          context: {
            entryId: row.id,
            entryType: row.type,
            title: row.title ?? "",
            excerpt: (row.bodyText ?? "").slice(0, 200),
            anchorKey: "随机精选",
          },
        });
        break;
      }
    }
  }

  // 评分降序，取最高分候选
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 1);
}

// ─── 场景二：Milestones ───────────────────────────────────────────────────────

async function scanMilestones(
  db: any,
  recipientUserId: string,
  nowTs: number
): Promise<CompanionCandidate[]> {
  // 读取已解锁的里程碑，找到"还未庆祝"或"提前 3 天"的节点
  const rows = await db
    .select({
      id: milestoneUnlock.id,
      milestoneKey: milestoneUnlock.milestoneKey,
      unlockedAt: milestoneUnlock.unlockedAt,
      celebratedAt: milestoneUnlock.celebratedAt,
    })
    .from(milestoneUnlock)
    .where(isNull(milestoneUnlock.celebratedAt));

  const todayKey = beijingTodayKey(nowTs);
  const todayStart = beijingStartOfDayUnix(todayKey);
  const candidates: CompanionCandidate[] = [];

  for (const row of rows) {
    // 里程碑触发日 = unlockedAt 所在北京日
    const milestoneKey = beijingTodayKey(row.unlockedAt);
    const milestoneStart = beijingStartOfDayUnix(milestoneKey);

    // 今天 or 提前 3 天窗口
    const diff = Math.round((todayStart - milestoneStart) / 86400);
    const isToday = diff === 0;
    const isAdvance = diff >= -3 && diff < 0;
    if (!isToday && !isAdvance) continue;

    // 避免对同一里程碑重复推送
    const alreadyPushed = await db
      .select({ id: companionLog.id })
      .from(companionLog)
      .where(
        and(
          eq(companionLog.recipientUserId, recipientUserId),
          eq(companionLog.targetId, row.milestoneKey),
          eq(companionLog.type, "milestone"),
          eq(companionLog.status, "sent"),
          gte(companionLog.createdAt, todayStart)
        )
      )
      .limit(1)
      .get();
    if (alreadyPushed) continue;

    candidates.push({
      type: "milestone",
      recipientUserId,
      targetId: row.milestoneKey,
      score: 60,
      context: {
        milestoneKey: row.milestoneKey,
        isToday,
        isAdvance,
        advanceDays: isAdvance ? Math.abs(diff) : 0,
        unlockedAt: row.unlockedAt,
      },
    });
  }

  return candidates.slice(0, 1);
}

// ─── 场景三：Gentle Digest ────────────────────────────────────────────────────

async function scanGentleDigest(
  db: any,
  recipientUserId: string,
  nowTs: number
): Promise<CompanionCandidate[]> {
  // 仅在 18:00~21:30 或次日 19:00~21:30 窗口运行
  const inPrimary = isInTimeWindow(18, 0, 21, 30, nowTs);
  const inFallback = isInTimeWindow(19, 0, 21, 30, nowTs);
  if (!inPrimary && !inFallback) return [];

  // 查找 6 小时内发布的 letter，尚未被阅读（用 readAt 近似：无法直接拿到，此处用"6h内创建"代替）
  const sixHoursAgo = nowTs - 6 * 3600;

  const rows = await db
    .select({
      id: entry.id,
      title: entry.title,
      bodyText: entry.bodyText,
      createdAt: entry.createdAt,
      userId: entry.userId,
    })
    .from(entry)
    .where(
      and(
        isNull(entry.deletedAt),
        eq(entry.type, "letter"),
        isNull(entry.parentId), // 主信，非回信
        gte(entry.createdAt, sixHoursAgo),
        sql`${entry.createdAt} <= ${nowTs}`,
        // 发信方不是收件方自己
        sql`${entry.userId} != ${recipientUserId}`
      )
    )
    .orderBy(desc(entry.createdAt))
    .limit(1);

  if (rows.length === 0) return [];

  const letter = rows[0];

  // 今天是否已推送过这封信的 digest
  const todayStart = beijingStartOfDayUnix(beijingTodayKey(nowTs));
  const alreadyPushed = await db
    .select({ id: companionLog.id })
    .from(companionLog)
    .where(
      and(
        eq(companionLog.recipientUserId, recipientUserId),
        eq(companionLog.targetId, letter.id),
        eq(companionLog.type, "digest"),
        eq(companionLog.status, "sent"),
        gte(companionLog.createdAt, todayStart)
      )
    )
    .limit(1)
    .get();
  if (alreadyPushed) return [];

  return [
    {
      type: "digest",
      recipientUserId,
      targetId: letter.id,
      score: 40,
      context: {
        entryId: letter.id,
        title: letter.title ?? "",
        excerpt: (letter.bodyText ?? "").slice(0, 100),
        createdAt: letter.createdAt,
      },
    },
  ];
}

// ─── 场景四：Weekly Reflection ────────────────────────────────────────────────

async function scanWeeklyReflection(
  db: any,
  recipientUserId: string,
  nowTs: number
): Promise<CompanionCandidate[]> {
  // 仅周日 19:00~21:00 执行
  const BEIJING_OFFSET_SECONDS = 8 * 3600;
  const d = new Date((nowTs + BEIJING_OFFSET_SECONDS) * 1000);
  const isSunday = d.getUTCDay() === 0;
  if (!isSunday) return [];
  if (!isInTimeWindow(19, 0, 21, 0, nowTs)) return [];

  // 统计本周（周一~周日）所有用户的记录
  const todayKey = beijingTodayKey(nowTs);
  const dayOfWeek = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  const weekStart = addBeijingDays(todayKey, -(dayOfWeek - 1));
  const weekStartTs = beijingStartOfDayUnix(weekStart);

  const rows = await db
    .select({
      id: entry.id,
      bodyText: entry.bodyText,
    })
    .from(entry)
    .where(
      and(
        isNull(entry.deletedAt),
        gte(entry.createdAt, weekStartTs),
        sql`${entry.createdAt} <= ${nowTs}`,
        sql`${entry.type} IN ('diary', 'timeline', 'letter', 'message')`
      )
    );

  const count = rows.length;
  const totalChars = rows.reduce((acc: number, r: { bodyText: string | null }) => acc + (r.bodyText ?? "").length, 0);

  if (count < WEEKLY_REFLECTION_MIN_ENTRIES && totalChars < WEEKLY_REFLECTION_MIN_CHARS) return [];

  // 本周是否已推过 weekly_reflection
  const alreadyPushed = await db
    .select({ id: companionLog.id })
    .from(companionLog)
    .where(
      and(
        eq(companionLog.recipientUserId, recipientUserId),
        eq(companionLog.type, "weekly_reflection"),
        eq(companionLog.status, "sent"),
        gte(companionLog.createdAt, weekStartTs)
      )
    )
    .limit(1)
    .get();
  if (alreadyPushed) return [];

  return [
    {
      type: "weekly_reflection",
      recipientUserId,
      targetId: null,
      score: 30,
      context: {
        entryCount: count,
        totalChars,
        weekStart,
        weekOf: todayKey,
        entryIds: rows.slice(0, 10).map((r: { id: string }) => r.id),
      },
    },
  ];
}

// ─── 主引擎入口 ───────────────────────────────────────────────────────────────

/**
 * 为空间所有用户执行一轮陪伴扫描。
 * 由 scheduled handler 每小时调用。
 */
export async function runCompanionEngine(
  db: any,
  nowTs = Math.floor(Date.now() / 1000)
): Promise<CompanionEngineResult> {
  const settingsMap = await readSettingsMap(db);

  // 1. 开关检查
  if (settingsMap["companion_enabled"] === "false") {
    return { dispatched: [], skipped: [] };
  }

  // 2. 自定义安静时段检查
  const parseTime = (raw: string | undefined, fallback: number): number => {
    if (!raw) return fallback;
    const [h, m] = raw.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return fallback;
    return h * 60 + m;
  };
  const quietStart = parseTime(settingsMap["companion_quiet_start"], 22 * 60 + 30);
  const quietEnd = parseTime(settingsMap["companion_quiet_end"], 8 * 60 + 30);
  const pushStart = parseTime(settingsMap["companion_push_start"], 9 * 60);
  const pushEnd = parseTime(settingsMap["companion_push_end"], 21 * 60 + 30);

  const m = beijingCurrentMinutes(nowTs);

  // 检查是否落入安静时段
  const inQuiet = quietStart > quietEnd ? (m >= quietStart || m < quietEnd) : (m >= quietStart && m < quietEnd);
  if (inQuiet) {
    return { dispatched: [], skipped: [] };
  }

  // 检查是否落入允许推送时段
  const inPushWindow = pushStart > pushEnd ? (m >= pushStart || m < pushEnd) : (m >= pushStart && m < pushEnd);
  if (!inPushWindow) {
    return { dispatched: [], skipped: [] };
  }

  const authors = await getSpaceAuthors(db);
  const dispatched: CompanionCandidate[] = [];
  const skipped: CompanionCandidate[] = [];

  for (const author of authors) {
    const userId = author.id;

    // 今日已达配额，跳过
    if (await hasDailyQuota(db, userId, nowTs)) continue;

    // 并行扫描所有场景
    const [milestones, memoryEchos, weeklyReflections, digests] = await Promise.all([
      scanMilestones(db, userId, nowTs),
      scanMemoryEcho(db, userId, nowTs),
      scanWeeklyReflection(db, userId, nowTs),
      scanGentleDigest(db, userId, nowTs),
    ]);

    // 按优先级合并所有候选
    const allCandidates = [
      ...milestones,
      ...memoryEchos,
      ...weeklyReflections,
      ...digests,
    ].sort((a, b) => SCENE_PRIORITY[a.type] - SCENE_PRIORITY[b.type]);

    if (allCandidates.length === 0) continue;

    // 取优先级最高的派发，其余记为 skipped
    const [winner, ...rest] = allCandidates;
    dispatched.push(winner);
    for (const c of rest) {
      skipped.push(c);
      await writeCompanionLog(db, c, "skipped", nowTs).catch(() => {});
    }
  }

  return { dispatched, skipped };
}


/**
 * 为指定用户生成一条测试陪伴候选（忽略安静时段与去重配额限制）。
 */
export async function scanTestCandidate(
  db: any,
  recipientUserId: string,
  nowTs = Math.floor(Date.now() / 1000)
): Promise<CompanionCandidate> {
  const [milestones, memoryEchos, weeklyReflections, digests] = await Promise.all([
    scanMilestones(db, recipientUserId, nowTs),
    scanMemoryEcho(db, recipientUserId, nowTs),
    scanWeeklyReflection(db, recipientUserId, nowTs),
    scanGentleDigest(db, recipientUserId, nowTs),
  ]);

  const allCandidates = [
    ...milestones,
    ...memoryEchos,
    ...weeklyReflections,
    ...digests,
  ].sort((a, b) => SCENE_PRIORITY[a.type] - SCENE_PRIORITY[b.type]);

  if (allCandidates.length > 0) {
    return { ...allCandidates[0], recipientUserId };
  }

  return {
    type: "memory_echo",
    recipientUserId,
    targetId: "test-memory",
    score: 100,
    context: {
      entryId: "test",
      entryType: "diary",
      title: "测试主动陪伴推送",
      excerpt: "这是一条测试陪伴卡片。主动陪伴引擎会自动关联历史记忆与恋爱契机，在合适的时间通过飞书与站内为你送上温暖的提示与回忆。",
      anchorKey: "测试推送",
    },
  };
}
