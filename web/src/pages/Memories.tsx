import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  TYPE_LABEL,
  celebrateMemoryMilestones,
  fetchMemoryMilestones,
  fetchMemoryNodes,
  fetchMemorySummary,
  fetchMemoryThemes,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  type MemoryNode,
  type MemorySummary,
  type MemoryThemeAlbum,
  type MilestoneUnlock,
} from "../lib/api";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import { MilestoneCelebrate } from "../components/MilestoneCelebrate";

const TYPE_TABS = [
  { key: "all", label: "全部" },
  { key: "letter", label: TYPE_LABEL.letter },
  { key: "diary", label: TYPE_LABEL.diary },
  { key: "message", label: TYPE_LABEL.message },
  { key: "timeline", label: TYPE_LABEL.timeline },
  { key: "photo", label: "有图" },
] as const;

interface DayCluster {
  date: string;
  monthKey: string;
  monthLabel: string;
  count: number;
  weight: number;
  dominantType: string;
  nodes: MemoryNode[];
}

interface MonthCluster {
  key: string;
  label: string;
  days: DayCluster[];
}

function nodeLabel(node: MemoryNode): string {
  return node.title?.trim() || node.snippet || formatDate(node.occurredAt);
}

function monthLabelFromKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return `${y}年${m}月`;
}

function aggregateByDay(nodes: MemoryNode[]): MonthCluster[] {
  const dayMap = new Map<string, DayCluster>();

  for (const node of nodes) {
    const date = formatDate(node.occurredAt);
    const monthKey = date.slice(0, 7);
    const existing = dayMap.get(date);
    if (existing) {
      existing.count += 1;
      existing.weight = Math.max(existing.weight, node.weight);
      existing.nodes.push(node);
      continue;
    }
    dayMap.set(date, {
      date,
      monthKey,
      monthLabel: monthLabelFromKey(monthKey),
      count: 1,
      weight: node.weight,
      dominantType: node.contentType,
      nodes: [node],
    });
  }

  for (const day of dayMap.values()) {
    const counts: Record<string, number> = {};
    for (const node of day.nodes) {
      counts[node.contentType] = (counts[node.contentType] ?? 0) + 1;
    }
    day.dominantType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    day.nodes.sort((a, b) => b.occurredAt - a.occurredAt);
  }

  const months = new Map<string, MonthCluster>();
  const days = [...dayMap.values()].sort((a, b) => b.date.localeCompare(a.date));
  for (const day of days) {
    const month = months.get(day.monthKey);
    if (month) {
      month.days.push(day);
    } else {
      months.set(day.monthKey, {
        key: day.monthKey,
        label: day.monthLabel,
        days: [day],
      });
    }
  }

  return [...months.values()].sort((a, b) => b.key.localeCompare(a.key));
}

function DayStarButton({
  day,
  active,
  onSelect,
}: {
  day: DayCluster;
  active: boolean;
  onSelect: () => void;
}) {
  const size = day.count >= 4 ? "lg" : day.count >= 2 ? "md" : "sm";
  return (
    <button
      type="button"
      className={`orbit-memory-day-star orbit-memory-day-star--${day.dominantType} orbit-memory-day-star--${size}${
        active ? " is-active" : ""
      }`}
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${day.date}，${day.count} 个瞬间`}
      title={`${day.date} · ${day.count} 个瞬间`}
    >
      <svg className="orbit-memory-day-glyph" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2.5 13.8 9.2 20.5 11 13.8 12.8 12 19.5 10.2 12.8 3.5 11 10.2 9.2Z" />
      </svg>
      {day.count > 1 ? (
        <span className="orbit-memory-day-count">{day.count}</span>
      ) : null}
    </button>
  );
}

function MemoriesTabs() {
  return (
    <div className="orbit-memory-tabs" role="tablist" aria-label="记忆视图">
      <NavLink
        to="/memories"
        end
        className={({ isActive }) =>
          `orbit-memory-tab${isActive ? " is-active" : ""}`
        }
      >
        星图
      </NavLink>
      <NavLink
        to="/memories/atlas"
        className={({ isActive }) =>
          `orbit-memory-tab${isActive ? " is-active" : ""}`
        }
      >
        图鉴
      </NavLink>
    </div>
  );
}

function MemoryHeader({
  title,
  subtitle,
  summary,
}: {
  title: string;
  subtitle: string;
  summary: MemorySummary | null;
}) {
  return (
    <header className="orbit-memory-header">
      <div>
        <h1 className="orbit-page-title">{title}</h1>
        <p className="orbit-muted orbit-memory-subtitle">{subtitle}</p>
      </div>
      <MemoriesTabs />
      {summary ? (
        <section className="orbit-memory-summary" aria-label="记忆概览">
          <div className="orbit-memory-stat">
            <span className="orbit-memory-stat-value">{summary.totalNodes}</span>
            <span className="orbit-memory-stat-label">个瞬间</span>
          </div>
          <div className="orbit-memory-stat">
            <span className="orbit-memory-stat-value">
              {summary.milestoneCount}
            </span>
            <span className="orbit-memory-stat-label">里程碑</span>
          </div>
          {summary.daysTogether != null ? (
            <div className="orbit-memory-stat">
              <span className="orbit-memory-stat-value">
                {summary.daysTogether}
              </span>
              <span className="orbit-memory-stat-label">天在一起</span>
            </div>
          ) : null}
        </section>
      ) : null}
    </header>
  );
}

export function MemoriesPage() {
  const toast = useToast();
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [nodes, setNodes] = useState<MemoryNode[]>([]);
  const [total, setTotal] = useState(0);
  const [milestones, setMilestones] = useState<MilestoneUnlock[]>([]);
  const [celebrateItems, setCelebrateItems] = useState<MilestoneUnlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dismissCelebrate = useCallback(() => {
    setCelebrateItems([]);
  }, []);

  useEffect(() => {
    setPageTitle("记忆 · 星图");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetchMemorySummary(),
      fetchMemoryNodes({ limit: 400, offset: 0 }),
      fetchMemoryMilestones(),
    ])
      .then(([nextSummary, page, milestoneRes]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setNodes(page.nodes);
        setTotal(page.total);
        setMilestones(milestoneRes.milestones);
        const fresh = milestoneRes.milestones.filter((item) => item.isNew);
        if (fresh.length > 0) {
          setCelebrateItems(fresh);
          void celebrateMemoryMilestones(fresh.map((item) => item.key)).then(
            (res) => {
              if (!cancelled) setMilestones(res.milestones);
            }
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载星图失败"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const months = useMemo(() => aggregateByDay(nodes), [nodes]);
  const litDays = useMemo(
    () => months.reduce((sum, month) => sum + month.days.length, 0),
    [months]
  );
  const selectedDay = useMemo(
    () =>
      months
        .flatMap((month) => month.days)
        .find((day) => day.date === selectedDate) ?? null,
    [months, selectedDate]
  );
  const regularMilestones = useMemo(
    () => milestones.filter((item) => item.category !== "constellation"),
    [milestones]
  );
  const constellations = useMemo(
    () => milestones.filter((item) => item.category === "constellation"),
    [milestones]
  );

  return (
    <div className="orbit-content orbit-memory" data-page="memories">
      {celebrateItems.length > 0 ? (
        <MilestoneCelebrate items={celebrateItems} onDone={dismissCelebrate} />
      ) : null}
      <MemoryHeader
        title="恋爱记忆"
        subtitle="我们一起记下的光点，点一点就能回到那天"
        summary={summary}
      />

      {loading ? (
        <p className="orbit-muted">点亮星图中…</p>
      ) : nodes.length === 0 ? (
        <p className="orbit-muted">
          还没有瞬间。去写一篇日记或一封信，第一颗星就亮了。
        </p>
      ) : (
        <>
          <p className="orbit-memory-caption">
            {litDays} 个有记录的日子
            {total > nodes.length
              ? ` · 展示最近 ${nodes.length} / 共 ${total} 篇`
              : null}
            {" · "}一点一天，互不重叠
          </p>

          <div className="orbit-memory-sky" aria-label="按日星图">
            <div className="orbit-memory-legend" aria-hidden>
              <span className="orbit-memory-legend-item orbit-memory-day-star--diary">
                日记
              </span>
              <span className="orbit-memory-legend-item orbit-memory-day-star--letter">
                信件
              </span>
              <span className="orbit-memory-legend-item orbit-memory-day-star--message">
                留言
              </span>
              <span className="orbit-memory-legend-item orbit-memory-day-star--timeline">
                时间线
              </span>
            </div>

            {months.map((month) => (
              <section key={month.key} className="orbit-memory-month">
                <h2 className="orbit-memory-month-title">{month.label}</h2>
                <div className="orbit-memory-day-grid">
                  {month.days.map((day) => (
                    <DayStarButton
                      key={day.date}
                      day={day}
                      active={selectedDate === day.date}
                      onSelect={() => setSelectedDate(day.date)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {selectedDay ? (
            <article className="orbit-memory-focus">
              <div className="orbit-memory-focus-meta">
                <span className="orbit-home-recent-type">{selectedDay.date}</span>
                <span className="orbit-muted">{selectedDay.count} 个瞬间</span>
              </div>
              <ul className="orbit-list-plain orbit-memory-day-entries">
                {selectedDay.nodes.map((node) => (
                  <li key={node.id}>
                    <Link to={node.link} className="orbit-entry-card">
                      <div className="orbit-entry-card-main">
                        <span className="orbit-home-recent-type">
                          {TYPE_LABEL[node.contentType] ?? node.contentType}
                        </span>
                        <strong className="orbit-entry-title orbit-entry-title-truncate">
                          {nodeLabel(node)}
                        </strong>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ) : (
            <p className="orbit-muted">点一颗星，看看那天留下了什么</p>
          )}

          {constellations.length > 0 ? (
            <section className="orbit-memory-milestones" aria-label="星座彩蛋">
              <h2 className="orbit-section-title">星座彩蛋</h2>
              <ul className="orbit-memory-milestone-list">
                {constellations.map((item) => (
                  <li
                    key={item.key}
                    className="orbit-memory-milestone-card orbit-memory-milestone-card--constellation"
                  >
                    <strong>{item.title}</strong>
                    <span className="orbit-muted">{item.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {regularMilestones.length > 0 ? (
            <section className="orbit-memory-milestones" aria-label="里程碑">
              <h2 className="orbit-section-title">已点亮的里程碑</h2>
              <ul className="orbit-memory-milestone-list">
                {regularMilestones.slice(0, 8).map((item) => (
                  <li key={item.key} className="orbit-memory-milestone-card">
                    <strong>{item.title}</strong>
                    <span className="orbit-muted">{item.description}</span>
                  </li>
                ))}
              </ul>
              <Link className="orbit-text-link" to="/memories/atlas">
                去图鉴看全部
              </Link>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export function MemoryAtlasPage() {
  const toast = useToast();
  const location = useLocation();
  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [nodes, setNodes] = useState<MemoryNode[]>([]);
  const [total, setTotal] = useState(0);
  const [milestones, setMilestones] = useState<MilestoneUnlock[]>([]);
  const [themes, setThemes] = useState<MemoryThemeAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeKey, setTypeKey] = useState<(typeof TYPE_TABS)[number]["key"]>("all");
  const [year, setYear] = useState<number | "all">("all");

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3];
  }, []);

  const constellations = useMemo(
    () => milestones.filter((item) => item.category === "constellation"),
    [milestones]
  );
  const regularMilestones = useMemo(
    () => milestones.filter((item) => item.category !== "constellation"),
    [milestones]
  );

  useEffect(() => {
    setPageTitle("记忆 · 图鉴");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const type =
      typeKey === "all" || typeKey === "photo" ? undefined : typeKey;
    void Promise.all([
      fetchMemorySummary(),
      fetchMemoryNodes({
        limit: 60,
        offset: 0,
        type,
        year: year === "all" ? undefined : year,
        hasCover: typeKey === "photo",
      }),
      fetchMemoryMilestones(),
      fetchMemoryThemes(),
    ])
      .then(([nextSummary, page, milestoneRes, themeRes]) => {
        if (cancelled) return;
        setSummary(nextSummary);
        setNodes(page.nodes);
        setTotal(page.total);
        setMilestones(milestoneRes.milestones);
        setThemes(themeRes.albums);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载图鉴失败"));
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast, typeKey, year, location.pathname]);

  return (
    <div className="orbit-content orbit-memory" data-page="memories-atlas">
      <MemoryHeader
        title="恋爱图鉴"
        subtitle="按类型和年份翻一翻，点点滴滴都是收藏"
        summary={summary}
      />

      <div className="orbit-memory-filters">
        <div className="orbit-memory-filter-row" role="tablist" aria-label="类型">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`orbit-memory-chip${typeKey === tab.key ? " is-active" : ""}`}
              onClick={() => setTypeKey(tab.key)}
            >
              {tab.label}
              {tab.key !== "all" &&
              tab.key !== "photo" &&
              summary?.byType[tab.key] != null
                ? ` ${summary.byType[tab.key]}`
                : ""}
            </button>
          ))}
        </div>
        <div className="orbit-memory-filter-row" role="tablist" aria-label="年份">
          <button
            type="button"
            className={`orbit-memory-chip${year === "all" ? " is-active" : ""}`}
            onClick={() => setYear("all")}
          >
            全部年份
          </button>
          {years.map((y) => (
            <button
              key={y}
              type="button"
              className={`orbit-memory-chip${year === y ? " is-active" : ""}`}
              onClick={() => setYear(y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {constellations.length > 0 ? (
        <section className="orbit-memory-milestones" aria-label="星座图鉴">
          <h2 className="orbit-section-title">星座彩蛋</h2>
          <ul className="orbit-memory-milestone-list">
            {constellations.map((item) => (
              <li
                key={item.key}
                className="orbit-memory-milestone-card orbit-memory-milestone-card--lg orbit-memory-milestone-card--constellation"
              >
                <strong>{item.title}</strong>
                <span className="orbit-muted">{item.description}</span>
                <span className="orbit-muted">
                  {formatDate(item.unlockedAt)} 点亮
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {regularMilestones.length > 0 ? (
        <section className="orbit-memory-milestones" aria-label="里程碑图鉴">
          <h2 className="orbit-section-title">里程碑</h2>
          <ul className="orbit-memory-milestone-list">
            {regularMilestones.map((item) => (
              <li
                key={item.key}
                className="orbit-memory-milestone-card orbit-memory-milestone-card--lg"
              >
                <strong>{item.title}</strong>
                <span className="orbit-muted">{item.description}</span>
                <span className="orbit-muted">
                  {formatDate(item.unlockedAt)} 点亮
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {themes.length > 0 ? (
        <section className="orbit-memory-themes" aria-label="主题分册">
          <h2 className="orbit-section-title">主题分册</h2>
          <p className="orbit-muted orbit-memory-caption">
            按关键词从现有回忆里归类（规则版，非 AI）
          </p>
          {themes.map((album) => (
            <div key={album.key} className="orbit-memory-theme-album">
              <h3 className="orbit-memory-theme-title">
                {album.title}
                <span className="orbit-muted"> · {album.count}</span>
              </h3>
              <ul className="orbit-memory-card-grid">
                {album.nodes.map((node) => (
                  <li key={`${album.key}-${node.id}`}>
                    <Link to={node.link} className="orbit-memory-card">
                      {node.coverImage ? (
                        <img
                          src={node.coverImage}
                          alt=""
                          className="orbit-memory-card-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={`orbit-memory-card-cover orbit-memory-card-cover--empty orbit-memory-day-star--${node.contentType}`}
                        />
                      )}
                      <div className="orbit-memory-card-body">
                        <span className="orbit-home-recent-type">
                          {TYPE_LABEL[node.contentType] ?? node.contentType}
                        </span>
                        <strong className="orbit-memory-card-title">
                          {nodeLabel(node)}
                        </strong>
                        <span className="orbit-muted">
                          {formatDate(node.occurredAt)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      <section className="orbit-memory-upcoming" aria-label="后续分册">
        <h2 className="orbit-section-title">后续分册</h2>
        <p className="orbit-muted">
          恋爱地图坐标、共同爱好册将在对应模块落地后接入；当前可先逛星座与主题分册。
        </p>
      </section>

      <section aria-label="记忆卡片">
        <h2 className="orbit-section-title">
          卡片{loading ? "" : ` · ${total}`}
        </h2>
        {loading ? (
          <p className="orbit-muted">翻图鉴中…</p>
        ) : nodes.length === 0 ? (
          <p className="orbit-muted">这个分册还是空的</p>
        ) : (
          <ul className="orbit-memory-card-grid">
            {nodes.map((node) => (
              <li key={node.id}>
                <Link to={node.link} className="orbit-memory-card">
                  {node.coverImage ? (
                    <img
                      src={node.coverImage}
                      alt=""
                      className="orbit-memory-card-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className={`orbit-memory-card-cover orbit-memory-card-cover--empty orbit-memory-day-star--${node.contentType}`}
                    />
                  )}
                  <div className="orbit-memory-card-body">
                    <span className="orbit-home-recent-type">
                      {TYPE_LABEL[node.contentType] ?? node.contentType}
                    </span>
                    <strong className="orbit-memory-card-title">
                      {nodeLabel(node)}
                    </strong>
                    <span className="orbit-muted">
                      {formatDate(node.occurredAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

