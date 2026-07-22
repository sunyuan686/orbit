import { and, asc, count, desc, eq, exists, gte, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { asset, entry, milestoneUnlock } from "../db/schema.js";
import { loadCoversForEntries } from "../lib/entry-covers.js";
import { generateId } from "../lib/id.js";
import { readSettingsMap } from "../db/settings-store.js";
import {
  SPACE_SETTING_KEYS,
  computeDaysTogether,
  parseAnniversaryToIso,
} from "../space-profile.js";
import {
  ACTIVITY_ENTRY_TYPES,
  getActivityStats,
} from "./activity.js";
import { loadFeishuRuntime } from "./feishu-settings.js";
import {
  getTenantAccessToken,
  sendFeishuInteractiveCard,
} from "./feishu-api.js";

export const MEMORY_ENTRY_TYPES = ACTIVITY_ENTRY_TYPES;

export type MemoryWeight = 1 | 2 | 3;

export interface MemoryNode {
  id: string;
  sourceType: "entry";
  sourceId: string;
  contentType: string;
  occurredAt: number;
  title: string | null;
  snippet: string;
  coverImage: string | null;
  author: string;
  weight: MemoryWeight;
  parentId: string | null;
  link: string;
}

export interface MemorySummary {
  totalNodes: number;
  byType: Record<string, number>;
  milestoneCount: number;
  constellationCount: number;
  recent: MemoryNode | null;
  latestMilestone: MilestoneUnlockView | null;
  daysTogether: number | null;
  anniversaryDate: string | null;
}

export interface MilestoneDefinition {
  key: string;
  title: string;
  description: string;
  category: "relationship" | "creation" | "streak" | "gallery" | "constellation";
}

export interface MilestoneUnlockView extends MilestoneDefinition {
  unlockedAt: number;
  celebratedAt: number | null;
  isNew: boolean;
}

export interface ListMemoryNodesOptions {
  limit?: number;
  offset?: number;
  type?: string;
  from?: number;
  to?: number;
  year?: number;
  hasCover?: boolean;
}

export interface ListMemoryNodesResult {
  nodes: MemoryNode[];
  total: number;
  limit: number;
  offset: number;
}

const SNIPPET_LEN = 80;

export const MILESTONE_DEFINITIONS: MilestoneDefinition[] = [
  {
    key: "days_7",
    title: "在一起满 7 天",
    description: "第一周的小星星亮起来了",
    category: "relationship",
  },
  {
    key: "days_30",
    title: "在一起满 30 天",
    description: "一个月的轨道已经画出来了",
    category: "relationship",
  },
  {
    key: "days_100",
    title: "在一起满 100 天",
    description: "一百个日夜，一百颗小心意",
    category: "relationship",
  },
  {
    key: "days_365",
    title: "在一起满一年",
    description: "绕太阳一圈，还想再绕很多圈",
    category: "relationship",
  },
  {
    key: "days_1000",
    title: "在一起满 1000 天",
    description: "一千天的光，都落在我们身上",
    category: "relationship",
  },
  {
    key: "first_letter",
    title: "第一封信",
    description: "信箱里落下第一颗星",
    category: "creation",
  },
  {
    key: "first_letter_reply",
    title: "第一封回信",
    description: "有来有往，才叫我们",
    category: "creation",
  },
  {
    key: "diary_10",
    title: "第 10 篇日记",
    description: "日常一点点堆成回忆",
    category: "creation",
  },
  {
    key: "diary_50",
    title: "第 50 篇日记",
    description: "半百篇悄悄话",
    category: "creation",
  },
  {
    key: "diary_100",
    title: "第 100 篇日记",
    description: "一百篇日记，一百个瞬间",
    category: "creation",
  },
  {
    key: "streak_7",
    title: "连续记录 7 天",
    description: "一周都没有落下",
    category: "streak",
  },
  {
    key: "streak_30",
    title: "连续记录 30 天",
    description: "整整一个月的坚持",
    category: "streak",
  },
  {
    key: "gallery_50",
    title: "相册满 50 张",
    description: "影像里的我们越来越多",
    category: "gallery",
  },
  {
    key: "gallery_100",
    title: "相册满 100 张",
    description: "一百帧画面，都是我们",
    category: "gallery",
  },
  // ── 星座彩蛋（M3）──
  {
    key: "constellation_penpals",
    title: "星座 · 鱼雁往来",
    description: "有信有回，轨道两端都亮着",
    category: "constellation",
  },
  {
    key: "constellation_habit",
    title: "星座 · 日日相记",
    description: "日记与连续记录交汇成习惯",
    category: "constellation",
  },
  {
    key: "constellation_orbit_year",
    title: "星座 · 一周年轨",
    description: "绕彼此转满一整圈",
    category: "constellation",
  },
  {
    key: "constellation_thousand",
    title: "星座 · 千日同辉",
    description: "一千天的光，连成一条河",
    category: "constellation",
  },
  {
    key: "constellation_album",
    title: "星座 · 百帧映画",
    description: "相册满百，画面成河",
    category: "constellation",
  },
  {
    key: "constellation_duet",
    title: "星座 · 双人笔迹",
    description: "两个人都往信箱里写过",
    category: "constellation",
  },
];

const MILESTONE_BY_KEY = new Map(
  MILESTONE_DEFINITIONS.map((item) => [item.key, item])
);

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function truncateSnippet(text: string | null | undefined): string {
  const raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= SNIPPET_LEN) return raw;
  return `${raw.slice(0, SNIPPET_LEN)}…`;
}

function computeWeight(input: {
  type: string;
  bodyLen: number;
  hasCover: boolean;
}): MemoryWeight {
  const long = input.bodyLen > 200;
  if ((input.type === "letter" && input.hasCover) || (input.hasCover && long)) {
    return 3;
  }
  if (input.hasCover || long || input.type === "letter") {
    return 2;
  }
  return 1;
}

function toNode(
  row: {
    id: string;
    type: string;
    title: string | null;
    snippetRaw: string | null;
    bodyLen: number | null;
    author: string;
    entryDate: number | null;
    createdAt: number;
    parentId: string | null;
  },
  coverImage: string | null
): MemoryNode {
  const occurredAt = row.entryDate ?? row.createdAt;
  const bodyLen = Number(row.bodyLen ?? 0);
  return {
    id: `entry:${row.id}`,
    sourceType: "entry",
    sourceId: row.id,
    contentType: row.type,
    occurredAt,
    title: row.title,
    snippet: truncateSnippet(row.snippetRaw),
    coverImage,
    author: row.author,
    weight: computeWeight({
      type: row.type,
      bodyLen,
      hasCover: Boolean(coverImage),
    }),
    parentId: row.parentId,
    link: `/${row.type}/${row.id}`,
  };
}

const entryListColumns = {
  id: entry.id,
  type: entry.type,
  title: entry.title,
  snippetRaw: sql<string>`substr(coalesce(${entry.bodyText}, ''), 1, 120)`,
  bodyLen: sql<number>`length(coalesce(${entry.bodyText}, ''))`,
  author: entry.author,
  entryDate: entry.entryDate,
  createdAt: entry.createdAt,
  parentId: entry.parentId,
};

function buildEntryConditions(options: ListMemoryNodesOptions) {
  const conditions = [
    isNull(entry.deletedAt),
    inArray(entry.type, [...MEMORY_ENTRY_TYPES]),
  ];

  if (options.type && MEMORY_ENTRY_TYPES.includes(options.type as any)) {
    conditions.push(eq(entry.type, options.type));
  }
  if (options.from != null) {
    conditions.push(gte(entry.entryDate, options.from));
  }
  if (options.to != null) {
    conditions.push(lte(entry.entryDate, options.to));
  }
  if (options.year != null) {
    const from = Math.floor(Date.UTC(options.year, 0, 1) / 1000) - 8 * 3600;
    const to = Math.floor(Date.UTC(options.year + 1, 0, 1) / 1000) - 8 * 3600 - 1;
    conditions.push(gte(entry.entryDate, from));
    conditions.push(lte(entry.entryDate, to));
  }

  return and(...conditions);
}

export async function listMemoryNodes(
  db: any,
  options: ListMemoryNodesOptions = {}
): Promise<ListMemoryNodesResult> {
  const limit = Math.min(Math.max(options.limit ?? 60, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);
  const where = buildEntryConditions(options);

  if (options.hasCover) {
    const coveredWhere = and(
      where,
      exists(
        db
          .select({ id: asset.id })
          .from(asset)
          .where(and(eq(asset.entryId, entry.id), isNull(asset.deletedAt)))
      )
    );
    const [totalRow] = await db
      .select({ value: count() })
      .from(entry)
      .where(coveredWhere);

    const covered = await db
      .select(entryListColumns)
      .from(entry)
      .where(coveredWhere)
      .orderBy(desc(entry.entryDate), desc(entry.createdAt))
      .limit(limit)
      .offset(offset);

    const covers = await loadCoversForEntries(
      db,
      covered.map((row: { id: string }) => row.id)
    );

    return {
      nodes: covered.map((row: any) => toNode(row, covers.get(row.id) ?? null)),
      total: Number(totalRow?.value ?? 0),
      limit,
      offset,
    };
  }

  const [totalRow] = await db
    .select({ value: count() })
    .from(entry)
    .where(where);

  const rows = await db
    .select(entryListColumns)
    .from(entry)
    .where(where)
    .orderBy(desc(entry.entryDate), desc(entry.createdAt))
    .limit(limit)
    .offset(offset);

  const covers = await loadCoversForEntries(
    db,
    rows.map((row: { id: string }) => row.id)
  );

  return {
    nodes: rows.map((row: any) => toNode(row, covers.get(row.id) ?? null)),
    total: Number(totalRow?.value ?? 0),
    limit,
    offset,
  };
}

export async function getMemorySummary(db: any): Promise<MemorySummary> {
  const [typeRows, recentResult, { milestones }, settingsMap] = await Promise.all([
    db
      .select({
        type: entry.type,
        value: count(),
      })
      .from(entry)
      .where(
        and(
          isNull(entry.deletedAt),
          inArray(entry.type, [...MEMORY_ENTRY_TYPES])
        )
      )
      .groupBy(entry.type),
    listMemoryNodes(db, { limit: 1, offset: 0 }),
    syncMilestoneUnlocks(db),
    readSettingsMap(db),
  ]);

  const byType: Record<string, number> = {
    diary: 0,
    timeline: 0,
    message: 0,
    letter: 0,
  };
  let totalNodes = 0;
  for (const row of typeRows) {
    byType[row.type] = Number(row.value);
    totalNodes += Number(row.value);
  }

  const constellationCount = milestones.filter(
    (item) => item.category === "constellation"
  ).length;

  const anniversaryDate = parseAnniversaryToIso(
    settingsMap[SPACE_SETTING_KEYS.anniversaryDate]
  );
  const daysTogether = anniversaryDate
    ? computeDaysTogether(anniversaryDate)
    : null;

  return {
    totalNodes,
    byType,
    milestoneCount: milestones.length,
    constellationCount,
    recent: recentResult.nodes[0] ?? null,
    latestMilestone: milestones[0] ?? null,
    daysTogether,
    anniversaryDate,
  };
}

async function countEntriesByType(db: any, type: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(entry)
    .where(
      and(isNull(entry.deletedAt), eq(entry.type, type))
    );
  return Number(row?.value ?? 0);
}

async function countLetterReplies(db: any): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(entry)
    .where(
      and(
        isNull(entry.deletedAt),
        eq(entry.type, "letter"),
        isNotNull(entry.parentId)
      )
    );
  return Number(row?.value ?? 0);
}

async function countGalleryImages(db: any): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(asset)
    .where(isNull(asset.deletedAt));
  return Number(row?.value ?? 0);
}

async function evaluateReachedKeys(db: any): Promise<Set<string>> {
  const reached = new Set<string>();

  const [
    settingsMap,
    letterCount,
    replyCount,
    diaryCount,
    activity,
    galleryCount,
    letterAuthors,
  ] = await Promise.all([
    readSettingsMap(db),
    countEntriesByType(db, "letter"),
    countLetterReplies(db),
    countEntriesByType(db, "diary"),
    getActivityStats(db, { days: 365 }),
    countGalleryImages(db),
    db
      .selectDistinct({ author: entry.author })
      .from(entry)
      .where(and(isNull(entry.deletedAt), eq(entry.type, "letter"))),
  ]);

  const anniversaryDate = parseAnniversaryToIso(
    settingsMap[SPACE_SETTING_KEYS.anniversaryDate]
  );
  const daysTogether = anniversaryDate
    ? computeDaysTogether(anniversaryDate)
    : null;

  if (daysTogether != null) {
    for (const days of [7, 30, 100, 365, 1000]) {
      if (daysTogether >= days) reached.add(`days_${days}`);
    }
  }

  if (letterCount >= 1) reached.add("first_letter");
  if (replyCount >= 1) reached.add("first_letter_reply");

  for (const n of [10, 50, 100]) {
    if (diaryCount >= n) reached.add(`diary_${n}`);
  }

  const streakBest = Math.max(activity.streak.current, activity.streak.longest);
  for (const n of [7, 30]) {
    if (streakBest >= n) reached.add(`streak_${n}`);
  }

  for (const n of [50, 100]) {
    if (galleryCount >= n) reached.add(`gallery_${n}`);
  }

  // 星座：基于已达成条件组合
  if (reached.has("first_letter") && reached.has("first_letter_reply")) {
    reached.add("constellation_penpals");
  }
  if (reached.has("diary_50") && reached.has("streak_7")) {
    reached.add("constellation_habit");
  }
  if (reached.has("days_365")) reached.add("constellation_orbit_year");
  if (reached.has("days_1000")) reached.add("constellation_thousand");
  if (reached.has("gallery_100")) reached.add("constellation_album");

  const authorCount = letterAuthors.filter(
    (row: { author: string }) => row.author?.trim()
  ).length;
  if (authorCount >= 2 && letterCount >= 10) {
    reached.add("constellation_duet");
  }

  return reached;
}

export interface SyncMilestonesResult {
  milestones: MilestoneUnlockView[];
  newlyUnlocked: MilestoneUnlockView[];
}

export async function syncMilestoneUnlocks(
  db: any
): Promise<SyncMilestonesResult> {
  const reached = await evaluateReachedKeys(db);
  const existing = await db.select().from(milestoneUnlock);
  const existingKeys = new Set(
    existing.map((row: { milestoneKey: string }) => row.milestoneKey)
  );

  const timestamp = now();
  const newlyUnlocked: MilestoneUnlockView[] = [];
  const insertRows: Array<{
    id: string;
    milestoneKey: string;
    unlockedAt: number;
    celebratedAt: null;
  }> = [];

  for (const key of reached) {
    if (existingKeys.has(key) || !MILESTONE_BY_KEY.has(key)) continue;
    insertRows.push({
      id: generateId("ms"),
      milestoneKey: key,
      unlockedAt: timestamp,
      celebratedAt: null,
    });
    const def = MILESTONE_BY_KEY.get(key)!;
    newlyUnlocked.push({
      ...def,
      unlockedAt: timestamp,
      celebratedAt: null,
      isNew: true,
    });
  }

  if (insertRows.length > 0) {
    if (typeof db.batch === "function") {
      await db.batch(
        insertRows.map((row) => db.insert(milestoneUnlock).values(row))
      );
    } else {
      for (const row of insertRows) {
        await db.insert(milestoneUnlock).values(row);
      }
    }
  }

  // 历史回填：一次解锁过多视为存量，直接标已庆祝，避免飞书轰炸与弹窗刷屏
  if (newlyUnlocked.length > 3) {
    const celebrateKeys = newlyUnlocked.map((item) => item.key);
    if (typeof db.batch === "function") {
      await db.batch(
        celebrateKeys.map((key) =>
          db
            .update(milestoneUnlock)
            .set({ celebratedAt: timestamp })
            .where(eq(milestoneUnlock.milestoneKey, key))
        )
      );
    } else {
      for (const key of celebrateKeys) {
        await db
          .update(milestoneUnlock)
          .set({ celebratedAt: timestamp })
          .where(eq(milestoneUnlock.milestoneKey, key));
      }
    }
    const milestones = await listUnlockedMilestones(db);
    return {
      milestones: milestones.map((item) => ({ ...item, isNew: false })),
      newlyUnlocked: [],
    };
  }

  const milestones = await listUnlockedMilestones(db);
  return { milestones, newlyUnlocked };
}

async function listUnlockedMilestones(db: any): Promise<MilestoneUnlockView[]> {
  const rows = await db
    .select()
    .from(milestoneUnlock)
    .orderBy(desc(milestoneUnlock.unlockedAt));

  return rows
    .map((row: {
      milestoneKey: string;
      unlockedAt: number;
      celebratedAt: number | null;
    }) => {
      const def = MILESTONE_BY_KEY.get(row.milestoneKey);
      if (!def) return null;
      return {
        ...def,
        unlockedAt: row.unlockedAt,
        celebratedAt: row.celebratedAt,
        isNew: row.celebratedAt == null,
      } satisfies MilestoneUnlockView;
    })
    .filter(Boolean) as MilestoneUnlockView[];
}

export async function celebrateMilestones(
  db: any,
  keys: string[]
): Promise<MilestoneUnlockView[]> {
  const unique = [...new Set(keys.filter((key) => MILESTONE_BY_KEY.has(key)))];
  if (unique.length === 0) {
    return (await syncMilestoneUnlocks(db)).milestones;
  }

  const timestamp = now();
  if (typeof db.batch === "function") {
    await db.batch(
      unique.map((key) =>
        db
          .update(milestoneUnlock)
          .set({ celebratedAt: timestamp })
          .where(
            and(
              eq(milestoneUnlock.milestoneKey, key),
              isNull(milestoneUnlock.celebratedAt)
            )
          )
      )
    );
  } else {
    for (const key of unique) {
      await db
        .update(milestoneUnlock)
        .set({ celebratedAt: timestamp })
        .where(
          and(
            eq(milestoneUnlock.milestoneKey, key),
            isNull(milestoneUnlock.celebratedAt)
          )
        );
    }
  }

  return (await syncMilestoneUnlocks(db)).milestones;
}

export function buildMilestoneFeishuCard(
  milestone: MilestoneUnlockView,
  memoriesUrl: string
): Record<string, unknown> {
  return {
    config: { wide_screen_mode: true },
    header: {
      template: "indigo",
      title: {
        tag: "plain_text",
        content:
          milestone.category === "constellation"
            ? "Orbit · 星座亮起"
            : "Orbit · 里程碑亮起",
      },
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "lark_md",
          content: `**${milestone.title}**\n${milestone.description}`,
        },
      },
      {
        tag: "action",
        actions: [
          {
            tag: "button",
            type: "primary",
            text: { tag: "plain_text", content: "去记忆页看看" },
            url: memoriesUrl,
          },
        ],
      },
    ],
  };
}

export async function notifyMilestonesViaFeishu(
  db: any,
  secret: string,
  baseUrl: string,
  milestones: MilestoneUnlockView[]
): Promise<void> {
  if (milestones.length === 0) return;

  const runtime = await loadFeishuRuntime(db, secret);
  if (!runtime.config.enabled || !runtime.config.appId || !runtime.secrets.appSecret) {
    return;
  }

  const openIds = Object.values(runtime.config.authorOpenIds).filter(
    (id) => typeof id === "string" && id.trim()
  );
  const homeChat = runtime.config.homeChatId.trim();
  const targets: Array<{ id: string; type: "open_id" | "chat_id" }> = [];
  if (homeChat) {
    targets.push({ id: homeChat, type: "chat_id" });
  } else {
    for (const openId of openIds) {
      targets.push({ id: openId.trim(), type: "open_id" });
    }
  }
  if (targets.length === 0) return;

  const token = await getTenantAccessToken(
    runtime.config.appId,
    runtime.secrets.appSecret
  );
  const memoriesUrl = `${baseUrl.replace(/\/$/, "")}/memories`;

  for (const milestone of milestones) {
    const card = buildMilestoneFeishuCard(milestone, memoriesUrl);
    for (const target of targets) {
      try {
        await sendFeishuInteractiveCard(
          token,
          target.id,
          target.type,
          card
        );
      } catch {
        // 单目标失败不阻断其余
      }
    }
  }
}

/** 星图布局：按时间排序后等距铺开，避免密段叠成一团 */
export function layoutTimeline(
  nodes: MemoryNode[],
  options: { height?: number; spacing?: number } = {}
): {
  width: number;
  height: number;
  nodes: Array<MemoryNode & { x: number; y: number }>;
} {
  const height = options.height ?? 260;
  const spacing = options.spacing ?? 32;
  const pad = 48;
  if (nodes.length === 0) {
    return { width: 720, height, nodes: [] };
  }

  const sorted = [...nodes].sort((a, b) => a.occurredAt - b.occurredAt);
  const width = Math.max(720, pad * 2 + (sorted.length - 1) * spacing);
  const mid = height / 2;
  const lanes = [-56, -28, 0, 28, 56];

  const laidOut = sorted.map((node, index) => {
    const x = pad + index * spacing;
    let hash = 0;
    for (let i = 0; i < node.sourceId.length; i++) {
      hash = (hash + node.sourceId.charCodeAt(i) * (i + 1)) % 997;
    }
    const lane = lanes[hash % lanes.length];
    const y = mid + lane - (node.weight - 2) * 3;
    return { ...node, x, y };
  });

  return { width, height, nodes: laidOut };
}

/** 规则主题分册（M3 轻量版，非 LLM） */
export const THEME_ALBUM_DEFS = [
  {
    key: "travel",
    title: "旅行与见面",
    keywords: ["见面", "旅行", "出去玩", "高铁", "飞机", "火车", "酒店", "景区", "演唱会"],
  },
  {
    key: "food",
    title: "一起吃过",
    keywords: ["吃", "美食", "火锅", "蛋糕", "晚饭", "午饭", "早餐", "外卖"],
  },
  {
    key: "miss",
    title: "想你的时候",
    keywords: ["想你", "想臭宝", "思念", "异地", "视频", "电话"],
  },
  {
    key: "letter_mood",
    title: "信里的话",
    keywords: [],
    types: ["letter"] as string[],
  },
  {
    key: "timeline_moments",
    title: "时间线高光",
    keywords: [],
    types: ["timeline"] as string[],
  },
] as const;

export interface ThemeAlbum {
  key: string;
  title: string;
  count: number;
  nodes: MemoryNode[];
}

export async function listThemeAlbums(
  db: any,
  options: { limitPerAlbum?: number } = {}
): Promise<ThemeAlbum[]> {
  const limitPerAlbum = Math.min(Math.max(options.limitPerAlbum ?? 12, 1), 40);
  const page = await listMemoryNodes(db, { limit: 400, offset: 0 });
  const albums: ThemeAlbum[] = [];

  for (const def of THEME_ALBUM_DEFS) {
    const matched = page.nodes.filter((node) => {
      if ("types" in def && def.types?.length) {
        return def.types.includes(node.contentType);
      }
      const hay = `${node.title ?? ""} ${node.snippet}`.toLowerCase();
      return def.keywords.some((kw) => hay.includes(kw.toLowerCase()));
    });
    if (matched.length === 0) continue;
    albums.push({
      key: def.key,
      title: def.title,
      count: matched.length,
      nodes: matched.slice(0, limitPerAlbum),
    });
  }

  return albums;
}
