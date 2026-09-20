import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { asset, entry } from "../../db/schema.js";
import { loadCoversForEntries } from "../../lib/entry-covers.js";
import { readSettingsMap } from "../../db/settings-store.js";
import {
  SPACE_SETTING_KEYS,
  computeDaysTogether,
  parseAnniversaryToIso,
} from "../../space-profile.js";
import {
  addBeijingDays,
  beijingDateKeyFromUnix,
  beijingStartOfDayUnix,
  beijingTodayKey,
  parseBeijingDateKey,
} from "../../lib/beijing-date.js";

export interface ScratchCardItem {
  id: string;
  badge?: string | null;
  title: string | null;
  meta: string;
  quote: string;
  link: string;
  linkText: string;
  type: string;
  coverImage?: string | null;
  mode: "daily" | "roam";
  dateKey?: string;
}

const TYPE_LABEL_MAP: Record<string, string> = {
  moment: "动态",
  letter: "书信",
};

const DAILY_COUPLE_PROMPTS = [
  {
    title: "【心动记忆提问】",
    quote: "还记得对方为你做过的哪件微小的事情，最让你心头一暖吗？今晚不妨聊聊看。",
  },
  {
    title: "【恋爱微光话题】",
    quote: "第一次意识到自己深深喜欢上对方，是在哪一个瞬间？",
  },
  {
    title: "【日常心动默契】",
    quote: "如果这个周末可以放下所有琐事只去一个地方，你最想和对方去哪？",
  },
  {
    title: "【未来愿望清单】",
    quote: "两个人一起列过的愿望里，你现在最想一起去实现哪一个？",
  },
  {
    title: "【生活温柔时刻】",
    quote: "最近一次看着对方忍不住笑出来，是因为什么有趣的小细节？",
  },
  {
    title: "【美食与偏好】",
    quote: "在对方做过或带你吃过的所有美食里，你心目中的第一名是哪一道？",
  },
  {
    title: "【时光慢调对话】",
    quote: "用三个词来形容对方在你自己心中的模样，你会选哪三个词？",
  },
  {
    title: "【专属仪式感】",
    quote: "两个人之间最让你觉得踏实又安心的日常小习惯是什么？",
  },
  {
    title: "【心意交换时刻】",
    quote: "今天有什么想听对方亲口对你说的小鼓励或情话吗？",
  },
  {
    title: "【小确幸收集】",
    quote: "今天发生的一件让你觉得特别舒服或治愈的小事是什么？",
  },
  {
    title: "【电影与故事】",
    quote: "如果选一部电影或一首歌代表我们俩的故事，你会选哪一首？",
  },
  {
    title: "【旅行闪回录】",
    quote: "一起走过的旅途里，哪一段风景或小插曲现在想起来依然印象深刻？",
  },
  {
    title: "【感谢有你陪伴】",
    quote: "想对今天辛苦了一天的对方，说一句怎样的悄悄话？",
  },
  {
    title: "【晚安秘密夜话】",
    quote: "睡前给对方一个大大的拥抱，或者分享一个今天突然想到的脑洞吧。",
  },
];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function truncateSnippet(text: string | null | undefined, maxLen = 80): string {
  const raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return "";
  if (raw.length <= maxLen) return raw;
  return `${raw.slice(0, maxLen)}…`;
}

function formatEntryMeta(author: string | null, dateTs: number | null): string {
  const authorStr = author ? `@${author}` : "";
  const dateStr = dateTs ? beijingDateKeyFromUnix(dateTs) : "";
  if (authorStr && dateStr) return `${authorStr} · ${dateStr}`;
  return authorStr || dateStr;
}

function buildEntryCard(
  item: {
    id: string;
    type: string;
    title: string | null;
    snippetRaw: string | null;
    author: string | null;
    entryDate: number | null;
    createdAt: number;
  },
  badge: string | null,
  mode: "daily" | "roam",
  coverImage?: string | null,
  dateKey?: string
): ScratchCardItem {
  const occurredAt = item.entryDate ?? item.createdAt;
  const quote = truncateSnippet(item.snippetRaw) || item.title?.trim() || "翻开那一天，看看我们当时的心情...";
  const title = item.title?.trim() || null;

  return {
    id: `entry-${item.id}`,
    badge,
    title,
    meta: formatEntryMeta(item.author, occurredAt),
    quote,
    link: `/${item.type}/${item.id}`,
    linkText: "查看全文 ➔",
    type: item.type,
    coverImage: coverImage ?? null,
    mode,
    dateKey,
  };
}

/**
 * 获取今日专属刮刮卡（按日期确定性抽取，双人同频）
 */
export async function getDailyScratchCard(
  db: any,
  options: { dateStr?: string; referenceTs?: number } = {}
): Promise<ScratchCardItem> {
  const todayKey =
    parseBeijingDateKey(options.dateStr) ??
    beijingTodayKey(options.referenceTs);
  const [yearStr, monthStr, dayStr] = todayKey.split("-");
  const targetYear = parseInt(yearStr, 10);
  const targetMonthDay = `${monthStr}-${dayStr}`;

  // 1. 优先检索：那年今日（历史年份的同月同日）
  const onThisDayEntries = await db
    .select({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      snippetRaw: sql<string>`substr(coalesce(${entry.bodyText}, ''), 1, 120)`,
      author: entry.author,
      entryDate: entry.entryDate,
      createdAt: entry.createdAt,
    })
    .from(entry)
    .where(
      and(
        isNull(entry.deletedAt),
        eq(entry.status, "published"),
        inArray(entry.type, ["moment", "letter"]),
        sql`strftime('%m-%d', datetime(coalesce(${entry.entryDate}, ${entry.createdAt}), 'unixepoch', '+8 hours')) = ${targetMonthDay}`,
        sql`cast(strftime('%Y', datetime(coalesce(${entry.entryDate}, ${entry.createdAt}), 'unixepoch', '+8 hours')) as integer) < ${targetYear}`
      )
    );

  if (onThisDayEntries.length > 0) {
    const chosenIndex = simpleHash(todayKey) % onThisDayEntries.length;
    const chosen = onThisDayEntries[chosenIndex];
    const covers = await loadCoversForEntries(db, [chosen.id]);
    const entryOccurredAt = chosen.entryDate ?? chosen.createdAt;
    const entryYear = parseInt(
      beijingDateKeyFromUnix(entryOccurredAt).slice(0, 4),
      10
    );
    const yearDiff = Math.max(targetYear - entryYear, 1);

    return buildEntryCard(
      chosen,
      `那年今日 · ${yearDiff}年前`,
      "daily",
      covers.get(chosen.id)?.url,
      todayKey
    );
  }

  // 2. 检索相伴里程碑 / 特殊周年
  const settingsMap = await readSettingsMap(db);
  const anniversaryIso = parseAnniversaryToIso(settingsMap.anniversary_date);
  const refDate = options.referenceTs
    ? new Date(options.referenceTs * 1000)
    : new Date();
  const daysTogether = anniversaryIso
    ? computeDaysTogether(anniversaryIso, refDate)
    : null;

  if (
    daysTogether != null &&
    (daysTogether % 100 === 0 ||
      daysTogether === 520 ||
      daysTogether === 1314 ||
      daysTogether === 365)
  ) {
    return {
      id: `milestone-${daysTogether}`,
      badge: "相伴里程碑",
      title: `在一起的第 ${daysTogether} 天`,
      meta: "漫漫星河里的同频相伴",
      quote: "谢谢你陪我走过的每一个日日夜夜，每一刻都是值得珍藏的奇迹。",
      link: "/memories/atlas",
      linkText: "查看恋爱图鉴 ➔",
      type: "memories",
      mode: "daily",
      dateKey: todayKey,
    };
  }

  // 3. 历史回忆打捞（抽取 > 7 天前的已发布历史条目，确定性伪随机）
  const sevenDaysAgoUnix = beijingStartOfDayUnix(
    addBeijingDays(todayKey, -7)
  );
  const historicEntries = await db
    .select({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      snippetRaw: sql<string>`substr(coalesce(${entry.bodyText}, ''), 1, 120)`,
      author: entry.author,
      entryDate: entry.entryDate,
      createdAt: entry.createdAt,
    })
    .from(entry)
    .where(
      and(
        isNull(entry.deletedAt),
        eq(entry.status, "published"),
        inArray(entry.type, ["moment", "letter"]),
        sql`coalesce(${entry.entryDate}, ${entry.createdAt}) <= ${sevenDaysAgoUnix}`
      )
    )
    .limit(80);

  if (historicEntries.length > 0) {
    const chosenIndex = simpleHash(todayKey) % historicEntries.length;
    const chosen = historicEntries[chosenIndex];
    const covers = await loadCoversForEntries(db, [chosen.id]);

    return buildEntryCard(
      chosen,
      null,
      "daily",
      covers.get(chosen.id)?.url,
      todayKey
    );
  }

  // 4. 保底：心动默契问答（按日轮换）
  const promptIndex = simpleHash(todayKey) % DAILY_COUPLE_PROMPTS.length;
  const prompt = DAILY_COUPLE_PROMPTS[promptIndex];

  return {
    id: `quiz-${todayKey}`,
    badge: "默契问答",
    title: prompt.title,
    meta: "双人互动小话题",
    quote: prompt.quote,
    link: "/",
    linkText: "去写下动态 ➔",
    type: "moment",
    mode: "daily",
    dateKey: todayKey,
  };
}

/**
 * 获取随机漫游刮刮卡（完全随机打捞历史回忆 / 相册 / 话题）
 */
export async function getRandomScratchCard(
  db: any,
  options: { excludeId?: string } = {}
): Promise<ScratchCardItem> {
  const excludeEntryId = options.excludeId?.startsWith("entry-")
    ? options.excludeId.replace("entry-", "")
    : null;

  // 随机抓取 10 条已发布条目
  const randomEntries = await db
    .select({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      snippetRaw: sql<string>`substr(coalesce(${entry.bodyText}, ''), 1, 120)`,
      author: entry.author,
      entryDate: entry.entryDate,
      createdAt: entry.createdAt,
    })
    .from(entry)
    .where(
      and(
        isNull(entry.deletedAt),
        eq(entry.status, "published"),
        inArray(entry.type, ["moment", "letter"]),
        excludeEntryId ? sql`${entry.id} != ${excludeEntryId}` : sql`1=1`
      )
    )
    .orderBy(sql`RANDOM()`)
    .limit(10);

  if (randomEntries.length > 0) {
    const chosen = randomEntries[0];
    const covers = await loadCoversForEntries(db, [chosen.id]);

    return buildEntryCard(
      chosen,
      null,
      "roam",
      covers.get(chosen.id)?.url
    );
  }

  // 检查相册
  const [photoCountRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(asset);
  const photoCount = Number(photoCountRow?.count ?? 0);

  if (photoCount > 0 && Math.random() > 0.5) {
    return {
      id: "photo-roam",
      badge: "珍藏相册",
      title: `定格了 ${photoCount} 个瞬间`,
      meta: "属于两人的记忆影集",
      quote: "无论日子流转多久，照片里的笑容依然清晰如昨。",
      link: "/gallery",
      linkText: "去相册翻看 ➔",
      type: "gallery",
      mode: "roam",
    };
  }

  // 随机心动问答
  const promptIndex = Math.floor(Math.random() * DAILY_COUPLE_PROMPTS.length);
  const prompt = DAILY_COUPLE_PROMPTS[promptIndex];

  return {
    id: `quiz-roam-${promptIndex}-${Date.now()}`,
    badge: "默契问答",
    title: prompt.title,
    meta: "双人互动小话题",
    quote: prompt.quote,
    link: "/",
    linkText: "去写下动态 ➔",
    type: "moment",
    mode: "roam",
  };
}

