import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  TYPE_LABEL,
  fetchEntries,
  fetchGallery,
  fetchSpaceStatus,
  formatAnniversaryCn,
  formatDate,
  formatSpaceTagline,
  getApiErrorMessage,
  shouldToastApiError,
  type EntrySummary,
  type GalleryItem,
  type SpaceAuthor,
} from "../lib/api";
import { entryDisplayLabel } from "../lib/letterThread";
import { useSpace } from "../lib/spaceContext";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import {
  DiaryIcon,
  TimelineIcon,
  MessageIcon,
  LetterIcon,
  MemoIcon,
  GalleryIcon,
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
  const [authors, setAuthors] = useState<SpaceAuthor[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [photos, setPhotos] = useState<GalleryItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);

  useEffect(() => {
    setPageTitle("首页");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadingFeed(true);

    void Promise.all([
      fetchSpaceStatus(),
      fetchEntries("diary"),
      fetchEntries("timeline"),
      fetchEntries("message"),
      fetchEntries("letter", { roots: true }),
      fetchGallery({ filter: "all", limit: 8, offset: 0 }),
    ])
      .then(([status, diary, timeline, message, letters, gallery]) => {
        if (cancelled) return;
        setAuthors(status.authors);

        const merged: RecentItem[] = [
          ...diary.map((e) => ({ ...e, contentType: "diary" })),
          ...timeline.map((e) => ({ ...e, contentType: "timeline" })),
          ...message.map((e) => ({ ...e, contentType: "message" })),
          ...letters.map((e) => ({ ...e, contentType: "letter" })),
        ];
        merged.sort((a, b) => (b.entryDate ?? 0) - (a.entryDate ?? 0));
        setRecent(merged.slice(0, 6));
        setPhotos(gallery.items);
      })
      .catch((err) => {
        if (cancelled) return;
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "首页加载失败"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingFeed(false);
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  const coupleNames = useMemo(() => formatCoupleNames(authors), [authors]);
  const tagline = formatSpaceTagline(profile);
  const hasAnniversary = profile?.daysTogether != null && profile.daysTogether > 0;

  return (
    <div className="orbit-content orbit-home" data-page="home">
      <section className="orbit-home-hero" aria-labelledby="home-hero-title">
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
                  自 {formatAnniversaryCn(profile.anniversaryDate)} 起
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
        <Link to="/settings?tab=space" className="orbit-home-hero-link">
          空间档案
          <ChevronRightIcon size="sm" />
        </Link>
      </section>

      <section className="orbit-home-quick" aria-label="快速记录">
        <p className="orbit-home-section-label">今天想记录点什么</p>
        <div className="orbit-home-quick-actions">
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
      </section>

      <section className="orbit-home-section" aria-labelledby="home-nav-title">
        <h2 className="orbit-home-section-title" id="home-nav-title">
          探索
        </h2>
        <div className="orbit-home-grid">
          {NAV_CARDS.map(({ to, label, desc, Icon }) => (
            <Link key={to} to={to} className="orbit-home-card">
              <Icon size="md" className="orbit-home-card-icon" />
              <span className="orbit-home-card-body">
                <span className="orbit-home-card-title">{label}</span>
                <span className="orbit-home-card-desc">{desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

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
