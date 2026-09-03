import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import { FEED_ENTRY_TYPES, getSpaceTodayKey } from "@orbit/shared";

import {
  TYPE_LABEL,
  fetchDailyScratchCard,
  fetchEntries,
  fetchGallery,
  fetchMemorySummary,
  fetchRandomScratchCard,
  fetchSpaceStatus,
  formatAnniversaryCn,
  formatDate,
  formatSpaceTagline,
  getApiErrorMessage,
  shouldToastApiError,
  type EntryListPage,
  type EntrySummary,
  type ScratchCardData,
  type SpaceAuthor,
} from "../lib/api";
import { entryDisplayLabel } from "../lib/letterThread";
import { useSpace } from "../contexts/spaceContext";
import { queryKeys } from "../lib/queryKeys";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../hooks/useToast";
import { GalleryImage } from "../components/GalleryImage";
import { ScratchCard } from "../components/ScratchCard";
import { Container, Stack } from "../components/ui";
import {
  DiaryIcon,
  TimelineIcon,
  MessageIcon,
  LetterIcon,
  MemoIcon,
  GalleryIcon,
  MemoriesIcon,
  ChevronRightIcon,
  RefreshIcon,
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
  return entryDisplayLabel(entry) ?? "无标题";
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

  const todayDateKey = useMemo(() => getSpaceTodayKey(), []);

  const [customCard, setCustomCard] = useState<ScratchCardData | null>(null);
  const [scratchSeed, setScratchSeed] = useState<string | number>(todayDateKey);
  const [isDailyRevealed, setIsDailyRevealed] = useState(() => {
    try {
      return (
        localStorage.getItem(`orbit_scratch_revealed_${todayDateKey}`) ===
        "true"
      );
    } catch {
      return false;
    }
  });
  const [isRoamRevealed, setIsRoamRevealed] = useState(false);
  const [isDrawingRoam, setIsDrawingRoam] = useState(false);

  const homeEntryParams = { limit: 8, offset: 0 } as const;
  const feedTypes = FEED_ENTRY_TYPES;
  const entryQueries = useQueries({
    queries: feedTypes.map((t) => ({
      queryKey: queryKeys.entries(t, t === "letter" ? { roots: true, limit: 8, offset: 0 } : homeEntryParams),
      queryFn: (): Promise<EntryListPage> =>
        fetchEntries(t, t === "letter" ? { roots: true, limit: 8, offset: 0 } : homeEntryParams),
    })),
  });

  const statusQuery = useQuery({
    queryKey: queryKeys.spaceStatus,
    queryFn: fetchSpaceStatus,
  });
  const galleryQuery = useQuery({
    queryKey: queryKeys.gallery("all", homeEntryParams),
    queryFn: () => fetchGallery({ filter: "all", ...homeEntryParams }),
  });
  const memoriesQuery = useQuery({
    queryKey: queryKeys.memorySummary,
    queryFn: fetchMemorySummary,
  });
  const scratchCardQuery = useQuery({
    queryKey: queryKeys.scratchCard(todayDateKey),
    queryFn: () => fetchDailyScratchCard(todayDateKey),
  });

  const feedQueries = [
    ...entryQueries,
    statusQuery,
    galleryQuery,
    memoriesQuery,
    scratchCardQuery,
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
  const photos = galleryQuery.data?.items ?? [];

  const currentCard: ScratchCardData | null =
    customCard ?? scratchCardQuery.data?.card ?? null;
  const isCurrentCardDaily = !customCard;
  const isCurrentRevealed = isCurrentCardDaily
    ? isDailyRevealed
    : isRoamRevealed;

  const handleScratchComplete = () => {
    if (isCurrentCardDaily) {
      setIsDailyRevealed(true);
      try {
        localStorage.setItem(`orbit_scratch_revealed_${todayDateKey}`, "true");
      } catch {
        // ignore
      }
    } else {
      setIsRoamRevealed(true);
    }
  };

  const handleDrawRoamCard = async () => {
    if (isDrawingRoam) return;
    setIsDrawingRoam(true);
    try {
      const res = await fetchRandomScratchCard(currentCard?.id);
      setCustomCard(res.card);
      setScratchSeed(`${res.card.id}-${Date.now()}`);
      setIsRoamRevealed(false);
    } catch {
      toast.error("抽取失败，请重试");
    } finally {
      setIsDrawingRoam(false);
    }
  };

  const recent = useMemo(() => {
    if (entryQueries.some((q) => !q.data)) return [];
    const merged: RecentItem[] = entryQueries.flatMap((q, idx) => {
      const t = feedTypes[idx];
      return (q.data?.items ?? []).map((e) => ({ ...e, contentType: t }));
    });
    merged.sort((a, b) => (b.entryDate ?? 0) - (a.entryDate ?? 0));
    return merged.slice(0, 6);
  }, [entryQueries, feedTypes]);

  const coupleNames = useMemo(() => formatCoupleNames(authors), [authors]);
  const tagline = formatSpaceTagline(profile);
  const hasAnniversary = profile?.daysTogether != null && profile.daysTogether > 0;

  return (
    <Container size="standard" className="orbit-home" data-page="home">
      <Stack gap="2xl">
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

      {(scratchCardQuery.isLoading || currentCard) && (
        <section className="orbit-home-section" aria-label="时光记忆卡">
          <div className="orbit-scratch-card" data-type={currentCard?.type}>
            {scratchCardQuery.isLoading && !currentCard ? (
              <div className="orbit-scratch-skeleton" aria-hidden />
            ) : currentCard ? (
              <>
                {isCurrentRevealed && (
                  <button
                    type="button"
                    className={`orbit-scratch-float-btn${isDrawingRoam ? " is-spinning" : ""}`}
                    onClick={handleDrawRoamCard}
                    disabled={isDrawingRoam}
                    title="换一段记忆"
                    aria-label="换一段记忆"
                  >
                    <RefreshIcon size="sm" />
                  </button>
                )}
                <ScratchCard
                  seed={scratchSeed}
                  isAlreadyRevealed={isCurrentRevealed}
                  onScratchComplete={handleScratchComplete}
                  coverText={isCurrentCardDaily ? "拂 开 旧 时 光" : "时 光 漫 游"}
                  autoOpenModal={!isCurrentRevealed && Boolean(customCard)}
                >
                  <div className="orbit-scratch-card-body">
                    <div className="orbit-scratch-card-top">
                      {currentCard.badge && (
                        <span className="orbit-scratch-badge">{currentCard.badge}</span>
                      )}
                      {currentCard.meta && (
                        <span className="orbit-scratch-meta">{currentCard.meta}</span>
                      )}
                    </div>
                    {currentCard.title && (
                      <h3 className="orbit-scratch-title">{currentCard.title}</h3>
                    )}
                    <blockquote className="orbit-scratch-quote">
                      “{currentCard.quote}”
                    </blockquote>
                    <Link to={currentCard.link} className="orbit-scratch-link">
                      {currentCard.linkText}
                    </Link>
                  </div>
                </ScratchCard>
              </>
            ) : null}
          </div>
        </section>
      )}

      {/* 📷 最近照片流 */}
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
              <GalleryImage
                  src={item.thumbUrl ?? item.url}
                  blurhash={item.blurhash}
                  width={item.width}
                  height={item.height}
                  variant="home"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 🎨 探索 Bento Canvas 大棋盘 */}
      <section className="orbit-home-section" aria-labelledby="home-nav-title">
        <div className="orbit-home-section-header">
          <h2 className="orbit-home-section-title" id="home-nav-title">
            探索
          </h2>
        </div>
        <div className="orbit-home-bento-grid">
          {NAV_CARDS.map(({ to, label, desc, Icon }) => (
            <Link key={to} to={to} className="orbit-home-bento-tile" data-type={to.slice(1)}>
              <div className="orbit-home-bento-icon-box">
                <Icon size="md" className="orbit-home-bento-icon" />
              </div>
              <div className="orbit-home-bento-content">
                <span className="orbit-home-bento-title">{label}</span>
                <span className="orbit-home-bento-desc">{desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 💬 最近动态 Story Stream */}
      <section className="orbit-home-section" aria-labelledby="home-recent-title">
        <div className="orbit-home-section-header">
          <h2 className="orbit-home-section-title" id="home-recent-title">
            最近动态
          </h2>
        </div>
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
          <div className="orbit-home-story-stream">
            {recent.map((item) => (
              <Link
                key={`${item.contentType}-${item.id}`}
                to={`/${item.contentType}/${item.id}`}
                className="orbit-home-story-card"
                data-type={item.contentType}
              >
                <div className="orbit-home-story-header">
                  <span className="orbit-home-story-badge">
                    {TYPE_LABEL[item.contentType] ?? item.contentType}
                  </span>
                  {item.author && (
                    <>
                      <span className="orbit-muted" aria-hidden="true">·</span>
                      <span className="orbit-home-story-author">@{item.author}</span>
                    </>
                  )}
                  {item.entryDate && (
                    <span className="orbit-home-story-date">{formatDate(item.entryDate)}</span>
                  )}
                </div>
                <h3 className="orbit-home-story-title">{entryLabel(item)}</h3>
              </Link>
            ))}
          </div>
        )}
      </section>
      </Stack>
    </Container>
  );
}
