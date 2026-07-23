import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  TYPE_LABEL,
  fetchActivityStats,
  fetchEntries,
  fetchGallery,
  fetchMemorySummary,
  fetchSpaceStatus,
  formatAnniversaryCn,
  formatDate,
  formatSpaceTagline,
  getApiErrorMessage,
  shouldToastApiError,
  type EntryListPage,
  type EntrySummary,
  type SpaceAuthor,
} from "../lib/api";
import { entryDisplayLabel } from "../lib/letterThread";
import { useSpace } from "../lib/spaceContext";
import { queryKeys } from "../lib/queryKeys";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import {
  DiaryIcon,
  TimelineIcon,
  MessageIcon,
  LetterIcon,
  MemoIcon,
  GalleryIcon,
  MemoriesIcon,
  ChevronRightIcon,
} from "../components/OrbitIcons";

type RecentItem = EntrySummary & { contentType: string };

const NAV_CARDS = [
  {
    to: "/diary",
    label: TYPE_LABEL.diary,
    desc: "记录每天的点滴",
    Icon: DiaryIcon,
  },
  {
    to: "/timeline",
    label: TYPE_LABEL.timeline,
    desc: "里程碑与重要时刻",
    Icon: TimelineIcon,
  },
  {
    to: "/message",
    label: TYPE_LABEL.message,
    desc: "留给对方的话",
    Icon: MessageIcon,
  },
  {
    to: "/letter",
    label: TYPE_LABEL.letter,
    desc: "往来书信",
    Icon: LetterIcon,
  },
  {
    to: "/memo",
    label: TYPE_LABEL.memo,
    desc: "共同维护的备忘",
    Icon: MemoIcon,
  },
  {
    to: "/gallery",
    label: "相册",
    desc: "一起留下的照片",
    Icon: GalleryIcon,
  },
  {
    to: "/memories",
    label: "记忆",
    desc: "星图与图鉴",
    Icon: MemoriesIcon,
  },
] as const;

const QUICK_ACTIONS = [
  { to: "/diary/new", label: "写日记" },
  { to: "/letter/new", label: "写信" },
  { to: "/message/new", label: "留言" },
] as const;

function entryLabel(entry: EntrySummary): string {
  return entryDisplayLabel(entry) ?? (entry.entryDate ? formatDate(entry.entryDate) : "无标题");
}

function formatCoupleNames(authors: SpaceAuthor[]): string | null {
  if (authors.length === 0) return null;
  return authors.map((a) => a.name).join(" & ");
}

export function HomePage() {
  const toast = useToast();
  const { profile, loading: spaceLoading } = useSpace();
  const toastedError = useRef<unknown>(null);

  useEffect(() => {
    setPageTitle("首页");
  }, []);

  const homeEntryParams = { limit: 8, offset: 0 } as const;
  const entryQueries = useQueries({
    queries: [
      {
        queryKey: queryKeys.entries("diary", homeEntryParams),
        queryFn: (): Promise<EntryListPage> =>
          fetchEntries("diary", homeEntryParams),
      },
      {
        queryKey: queryKeys.entries("timeline", homeEntryParams),
        queryFn: (): Promise<EntryListPage> =>
          fetchEntries("timeline", homeEntryParams),
      },
      {
        queryKey: queryKeys.entries("message", homeEntryParams),
        queryFn: (): Promise<EntryListPage> =>
          fetchEntries("message", homeEntryParams),
      },
      {
        queryKey: queryKeys.entries("letter", {
          roots: true,
          limit: 8,
          offset: 0,
        }),
        queryFn: (): Promise<EntryListPage> =>
          fetchEntries("letter", { roots: true, limit: 8, offset: 0 }),
      },
    ],
  });

  const statusQuery = useQuery({
    queryKey: queryKeys.spaceStatus,
    queryFn: fetchSpaceStatus,
  });
  const galleryQuery = useQuery({
    queryKey: queryKeys.gallery("all", homeEntryParams),
    queryFn: () => fetchGallery({ filter: "all", ...homeEntryParams }),
  });
  const activityQuery = useQuery({
    queryKey: queryKeys.activityStats(365),
    queryFn: () => fetchActivityStats(365),
  });
  const memoriesQuery = useQuery({
    queryKey: queryKeys.memorySummary,
    queryFn: fetchMemorySummary,
  });

  const feedQueries = [
    ...entryQueries,
    statusQuery,
    galleryQuery,
    activityQuery,
    memoriesQuery,
  ];
  const loadingFeed = feedQueries.some((q) => q.isPending);
  const feedError = feedQueries.find((q) => q.error)?.error;

  useEffect(() => {
    if (!feedError || toastedError.current === feedError) return;
    toastedError.current = feedError;
    if (shouldToastApiError(feedError)) {
      toast.error(getApiErrorMessage(feedError, "首页加载失败"));
    }
  }, [feedError, toast]);

  const authors: SpaceAuthor[] = statusQuery.data?.authors ?? [];
  const activity = activityQuery.data ?? null;
  const memories = memoriesQuery.data ?? null;
  const photos = galleryQuery.data?.items ?? [];

  const diary = entryQueries[0]?.data;
  const timeline = entryQueries[1]?.data;
  const message = entryQueries[2]?.data;
  const letters = entryQueries[3]?.data;

  const recent = useMemo(() => {
    if (!diary || !timeline || !message || !letters) return [];
    const merged: RecentItem[] = [
      ...diary.items.map((e) => ({ ...e, contentType: "diary" })),
      ...timeline.items.map((e) => ({ ...e, contentType: "timeline" })),
      ...message.items.map((e) => ({ ...e, contentType: "message" })),
      ...letters.items.map((e) => ({ ...e, contentType: "letter" })),
    ];
    merged.sort((a, b) => (b.entryDate ?? 0) - (a.entryDate ?? 0));
    return merged.slice(0, 6);
  }, [diary, timeline, message, letters]);

  const coupleNames = useMemo(() => formatCoupleNames(authors), [authors]);
  const tagline = formatSpaceTagline(profile);
  const hasAnniversary = profile?.daysTogether != null && profile.daysTogether > 0;

  return (
    <div className="orbit-content orbit-home" data-page="home">
      <section className="orbit-home-hero" aria-labelledby="home-hero-title">
        <svg
          className="orbit-home-hero-orbit"
          viewBox="0 0 200 120"
          aria-hidden
        >
          <ellipse cx="100" cy="60" rx="92" ry="44" />
          <circle className="orbit-home-hero-planet orbit-home-hero-planet--a" cx="100" cy="16" r="4" />
          <circle className="orbit-home-hero-planet orbit-home-hero-planet--b" cx="100" cy="104" r="4" />
        </svg>
        <div className="orbit-home-hero-main">
          {spaceLoading ? (
            <p className="orbit-muted">加载中…</p>
          ) : hasAnniversary ? (
            <>
              <p className="orbit-home-hero-eyebrow" id="home-hero-title">
                {coupleNames ?? "我们的空间"}
              </p>
              <p
                className="orbit-home-hero-days"
                aria-label={`在一起第 ${profile!.daysTogether} 天`}
              >
                {profile!.daysTogether!.toLocaleString("zh-CN")}
                <span className="orbit-home-hero-days-unit">天</span>
              </p>
              {profile?.anniversaryDate && (
                <p className="orbit-home-hero-sub">
                  自 {formatAnniversaryCn(profile.anniversaryDate)} 起，一直在一起
                </p>
              )}
            </>
          ) : (
            <>
              <p className="orbit-home-hero-eyebrow" id="home-hero-title">
                {coupleNames ?? "我们的空间"}
              </p>
              <p className="orbit-home-hero-greeting">{profile?.slogan ?? tagline}</p>
              <p className="orbit-home-hero-sub">
                <Link to="/settings?tab=space" className="orbit-text-link">
                  设置纪念日
                </Link>
                ，让每一天都有计数
              </p>
            </>
          )}
          {hasAnniversary && profile?.slogan && (
            <p className="orbit-home-hero-slogan">{profile.slogan}</p>
          )}
        </div>
        <div className="orbit-home-hero-side">
          <div className="orbit-home-quick-actions" aria-label="快速记录">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={`orbit-btn orbit-btn-sm${action.to === "/diary/new" ? " orbit-btn-primary" : ""}`}
              >
                {action.label}
              </Link>
            ))}
          </div>
          <Link to="/settings?tab=space" className="orbit-home-hero-link">
            空间档案
            <ChevronRightIcon size="sm" />
          </Link>
        </div>
      </section>

      {!loadingFeed && memories && memories.totalNodes > 0 && (
        <section className="orbit-home-section" aria-labelledby="home-memories-title">
          <Link
            to="/memories"
            className="orbit-home-memories-card"
            aria-labelledby="home-memories-title"
          >
            <span className="orbit-home-memories-stars" aria-hidden>
              <i /><i /><i /><i /><i /><i />
            </span>
            <span className="orbit-home-memories-body">
              <span className="orbit-home-memories-title" id="home-memories-title">
                恋爱星图
              </span>
              <span className="orbit-home-memories-meta">
                {memories.totalNodes} 个瞬间 · {memories.milestoneCount} 个里程碑
                {memories.latestMilestone
                  ? ` · 最近点亮「${memories.latestMilestone.title}」`
                  : ""}
              </span>
              {memories.recent ? (
                <span className="orbit-home-memories-recent">
                  {TYPE_LABEL[memories.recent.contentType] ??
                    memories.recent.contentType}
                  ：
                  {memories.recent.title?.trim() ||
                    memories.recent.snippet ||
                    "最近一个瞬间"}
                </span>
              ) : null}
            </span>
            <ChevronRightIcon size="sm" className="orbit-home-memories-chevron" />
          </Link>
        </section>
      )}

      {!loadingFeed && photos.length > 0 && (
        <section className="orbit-home-section" aria-labelledby="home-photos-title">
          <div className="orbit-home-section-header">
            <h2 className="orbit-home-section-title" id="home-photos-title">
              最近照片
            </h2>
            <Link to="/gallery" className="orbit-text-link orbit-home-section-link">
              全部相册
            </Link>
          </div>
          <div className="orbit-home-photos">
            {photos.map((item) => (
              <Link
                key={item.storageKey}
                to="/gallery"
                className="orbit-home-photo"
                title="查看相册"
              >
                <img src={item.url} alt="" loading="lazy" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loadingFeed && activity && (
        <section className="orbit-home-section" aria-labelledby="home-activity-title">
          <div className="orbit-home-section-header">
            <div>
              <h2 className="orbit-home-section-title" id="home-activity-title">
                记录节奏
              </h2>
              <p className="orbit-home-activity-meta">
                连续 {activity.streak.current} 天
                <span className="orbit-home-activity-meta-sep" aria-hidden>
                  ·
                </span>
                近 {activity.summary.rangeDays} 天活跃 {activity.summary.activeDays} 天
              </p>
            </div>
            <Link to="/activity" className="orbit-text-link orbit-home-section-link">
              查看详情
            </Link>
          </div>
          <ActivityHeatmap days={activity.days} recentDays={84} compact />
        </section>
      )}

      <section className="orbit-home-section" aria-labelledby="home-nav-title">
        <h2 className="orbit-home-section-title" id="home-nav-title">
          探索
        </h2>
        <div className="orbit-home-grid">
          {NAV_CARDS.map(({ to, label, desc, Icon }) => (
            <Link key={to} to={to} className="orbit-home-card" data-type={to.slice(1)}>
              <span className="orbit-home-card-icon-chip">
                <Icon size="md" className="orbit-home-card-icon" />
              </span>
              <span className="orbit-home-card-body">
                <span className="orbit-home-card-title">{label}</span>
                <span className="orbit-home-card-desc">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="orbit-home-section" aria-labelledby="home-recent-title">
        <h2 className="orbit-home-section-title" id="home-recent-title">
          最近动态
        </h2>
        {loadingFeed ? (
          <p className="orbit-muted">加载中…</p>
        ) : recent.length === 0 ? (
          <div className="orbit-home-empty">
            <p>还没有内容，从第一篇日记开始吧。</p>
            <Link to="/diary/new" className="orbit-btn orbit-btn-sm">
              写日记
            </Link>
          </div>
        ) : (
          <ul className="orbit-list-plain orbit-entry-list orbit-home-recent">
            {recent.map((item) => (
              <li key={`${item.contentType}-${item.id}`}>
                <Link to={`/${item.contentType}/${item.id}`} className="orbit-entry-card">
                  <span className="orbit-entry-card-main">
                    <span className="orbit-home-recent-type">
                      {TYPE_LABEL[item.contentType] ?? item.contentType}
                    </span>
                    <span className="orbit-entry-title orbit-entry-title-truncate">
                      {entryLabel(item)}
                    </span>
                    {item.author && (
                      <span className="orbit-entry-author">{item.author}</span>
                    )}
                  </span>
                  {item.entryDate && (
                    <time className="orbit-entry-date" dateTime={formatDate(item.entryDate)}>
                      {formatDate(item.entryDate)}
                    </time>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
