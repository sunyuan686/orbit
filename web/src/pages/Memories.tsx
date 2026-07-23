import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  type MilestoneUnlock,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
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
  count: number;
  weight: number;
  dominantType: string;
  nodes: MemoryNode[];
  /** 星在天幕里的坐标（百分比）：x 按时间从左到右，y 伪随机散布 */
  x: number;
  y: number;
  /** 闪烁相位，稳定伪随机 */
  phase: number;
}

interface SkyModel {
  days: DayCluster[];
  /** 年份刻度（天幕底部的淡淡坐标） */
  yearTicks: { label: string; x: number }[];
}

/** 稳定伪随机：同一日期永远落在同一位置 */
function hash01(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function nodeLabel(node: MemoryNode): string {
  return node.title?.trim() || node.snippet || formatDate(node.occurredAt);
}

const DAY_MS = 86_400_000;

/**
 * 斥力松弛：把挤在一起的星推开到最小间距。
 * 百分比坐标按天幕近似尺寸（660×380px）换算成等距空间；
 * y 全量推、x 半量推，保住「左旧右新」的时间轴。
 * O(n²)×4 轮，n≤400，开销可忽略。
 */
function relaxOverlaps(days: DayCluster[]) {
  const PX_X = 6.6;
  const PX_Y = 3.8;
  const MIN_DIST = 21;
  for (let iter = 0; iter < 4; iter++) {
    for (let i = 0; i < days.length; i++) {
      for (let j = i + 1; j < days.length; j++) {
        const a = days[i];
        const b = days[j];
        let dx = (a.x - b.x) * PX_X;
        let dy = (a.y - b.y) * PX_Y;
        let dist = Math.hypot(dx, dy);
        if (dist >= MIN_DIST) continue;
        if (dist < 0.01) {
          dx = hash01(a.date + b.date) - 0.5;
          dy = 1;
          dist = Math.hypot(dx, dy);
        }
        const push = (MIN_DIST - dist) / 2 / dist;
        a.x = Math.min(97, Math.max(3, a.x + (dx * push * 0.5) / PX_X));
        b.x = Math.min(97, Math.max(3, b.x - (dx * push * 0.5) / PX_X));
        a.y = Math.min(86, Math.max(8, a.y + (dy * push) / PX_Y));
        b.y = Math.min(86, Math.max(8, b.y - (dy * push) / PX_Y));
      }
    }
  }
}

function buildSky(nodes: MemoryNode[]): SkyModel {
  const dayMap = new Map<string, DayCluster>();

  for (const node of nodes) {
    const date = formatDate(node.occurredAt);
    const existing = dayMap.get(date);
    if (existing) {
      existing.count += 1;
      existing.weight = Math.max(existing.weight, node.weight);
      existing.nodes.push(node);
      continue;
    }
    dayMap.set(date, {
      date,
      count: 1,
      weight: node.weight,
      dominantType: node.contentType,
      nodes: [node],
      x: 0,
      y: 12 + hash01(date) * 72,
      phase: hash01(date, 7),
    });
  }

  const days = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length === 0) return { days, yearTicks: [] };

  for (const day of days) {
    const counts: Record<string, number> = {};
    for (const node of day.nodes) {
      counts[node.contentType] = (counts[node.contentType] ?? 0) + 1;
    }
    day.dominantType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    day.nodes.sort((a, b) => b.occurredAt - a.occurredAt);
  }

  // x：时间轴左旧右新，加一点 hash 抖动避免排成直线
  const minT = Date.parse(days[0].date);
  const maxT = Date.parse(days[days.length - 1].date);
  const span = Math.max(maxT - minT, DAY_MS);
  for (const day of days) {
    const t = (Date.parse(day.date) - minT) / span;
    const jitter = (hash01(day.date, 13) - 0.5) * 2.4;
    day.x = Math.min(97, Math.max(3, 3 + t * 94 + jitter));
  }

  relaxOverlaps(days);

  const yearTicks: { label: string; x: number }[] = [];
  const firstYear = Number(days[0].date.slice(0, 4));
  const lastYear = Number(days[days.length - 1].date.slice(0, 4));
  for (let year = firstYear + 1; year <= lastYear; year++) {
    const t = (Date.parse(`${year}-01-01`) - minT) / span;
    const x = 3 + t * 94;
    if (x >= 6 && x <= 94) yearTicks.push({ label: `${year}`, x });
  }

  return { days, yearTicks };
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
      style={
        {
          left: `${day.x}%`,
          top: `${day.y}%`,
          animationDelay: `${(day.phase * 4).toFixed(2)}s`,
          "--star-rot": `${((day.phase - 0.5) * 36).toFixed(0)}deg`,
        } as React.CSSProperties
      }
      onClick={onSelect}
      aria-pressed={active}
      aria-label={`${day.date}，${day.count} 个瞬间`}
      title={`${day.date} · ${day.count} 个瞬间`}
    >
      <svg className="orbit-memory-day-glyph" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 0C13.15 6.6 17.4 10.85 24 12C17.4 13.15 13.15 17.4 12 24C10.85 17.4 6.6 13.15 0 12C6.6 10.85 10.85 6.6 12 0Z" />
      </svg>
      <span className="orbit-memory-day-date" aria-hidden>
        {day.date.slice(5).replace("-", "/")}
      </span>
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
  const queryClient = useQueryClient();
  const toastedError = useRef<unknown>(null);
  const [celebrateItems, setCelebrateItems] = useState<MilestoneUnlock[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const dismissCelebrate = useCallback(() => {
    setCelebrateItems([]);
  }, []);

  useEffect(() => {
    setPageTitle("记忆 · 星图");
  }, []);

  const summaryQuery = useQuery({
    queryKey: queryKeys.memorySummary,
    queryFn: fetchMemorySummary,
  });
  const nodesQuery = useQuery({
    queryKey: queryKeys.memoryNodes({ limit: 400, offset: 0 }),
    queryFn: () => fetchMemoryNodes({ limit: 400, offset: 0 }),
  });
  const milestonesQuery = useQuery({
    queryKey: queryKeys.memoryMilestones,
    queryFn: fetchMemoryMilestones,
  });

  const loading =
    summaryQuery.isPending || nodesQuery.isPending || milestonesQuery.isPending;
  const error =
    summaryQuery.error || nodesQuery.error || milestonesQuery.error;

  useEffect(() => {
    if (!error || toastedError.current === error) return;
    toastedError.current = error;
    if (shouldToastApiError(error)) {
      toast.error(getApiErrorMessage(error, "加载星图失败"));
    }
  }, [error, toast]);

  useEffect(() => {
    const milestones = milestonesQuery.data?.milestones;
    if (!milestones) return;
    const fresh = milestones.filter((item) => item.isNew);
    if (fresh.length === 0) return;
    setCelebrateItems(fresh);
    void celebrateMemoryMilestones(fresh.map((item) => item.key)).then(
      (res) => {
        queryClient.setQueryData(queryKeys.memoryMilestones, res);
      }
    );
  }, [milestonesQuery.data, queryClient]);

  const summary = summaryQuery.data ?? null;
  const nodes = nodesQuery.data?.nodes ?? [];
  const total = nodesQuery.data?.total ?? 0;
  const milestones = milestonesQuery.data?.milestones ?? [];

  const sky = useMemo(() => buildSky(nodes), [nodes]);
  const litDays = sky.days.length;
  const selectedDay = useMemo(
    () => sky.days.find((day) => day.date === selectedDate) ?? null,
    [sky, selectedDate]
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
            我们一起点亮了 {litDays} 个日子
            {total > nodes.length
              ? `（展示最近 ${nodes.length} / 共 ${total} 篇）`
              : null}
          </p>

          <div className="orbit-memory-sky" aria-label="按日星图">
            <div className="orbit-memory-sky-moon" aria-hidden />
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

            <div className="orbit-memory-field">
              {sky.days.map((day) => (
                <DayStarButton
                  key={day.date}
                  day={day}
                  active={selectedDate === day.date}
                  onSelect={() =>
                    setSelectedDate(selectedDate === day.date ? null : day.date)
                  }
                />
              ))}
              {sky.yearTicks.map((tick) => (
                <span
                  key={tick.label}
                  className="orbit-memory-year-tick"
                  style={{ left: `${tick.x}%` }}
                  aria-hidden
                >
                  {tick.label}
                </span>
              ))}
            </div>

            {selectedDay ? (
              <article className="orbit-memory-focus">
                <div className="orbit-memory-focus-meta">
                  <strong className="orbit-memory-focus-date">
                    {selectedDay.date}
                  </strong>
                  <span>{selectedDay.count} 个瞬间</span>
                </div>
                <ul className="orbit-list-plain orbit-memory-day-entries">
                  {selectedDay.nodes.map((node) => (
                    <li key={node.id}>
                      <Link to={node.link} className="orbit-memory-focus-entry">
                        <span
                          className={`orbit-memory-focus-dot orbit-memory-day-star--${node.contentType}`}
                          aria-hidden
                        />
                        <span className="orbit-memory-focus-type">
                          {TYPE_LABEL[node.contentType] ?? node.contentType}
                        </span>
                        <span className="orbit-entry-title orbit-entry-title-truncate">
                          {nodeLabel(node)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ) : (
              <p className="orbit-memory-sky-hint">点一颗星，回到那一天</p>
            )}
          </div>

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
  const toastedError = useRef<unknown>(null);
  const [typeKey, setTypeKey] = useState<(typeof TYPE_TABS)[number]["key"]>("all");
  const [year, setYear] = useState<number | "all">("all");

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3];
  }, []);

  useEffect(() => {
    setPageTitle("记忆 · 图鉴");
  }, []);

  const nodeType =
    typeKey === "all" || typeKey === "photo" ? undefined : typeKey;
  const nodesParams = {
    limit: 60,
    offset: 0,
    type: nodeType,
    year: year === "all" ? undefined : year,
    hasCover: typeKey === "photo",
  };

  const summaryQuery = useQuery({
    queryKey: queryKeys.memorySummary,
    queryFn: fetchMemorySummary,
  });
  const nodesQuery = useQuery({
    queryKey: queryKeys.memoryNodes(nodesParams),
    queryFn: () => fetchMemoryNodes(nodesParams),
  });
  const milestonesQuery = useQuery({
    queryKey: queryKeys.memoryMilestones,
    queryFn: fetchMemoryMilestones,
  });
  const themesQuery = useQuery({
    queryKey: queryKeys.memoryThemes,
    queryFn: fetchMemoryThemes,
  });

  const loading =
    summaryQuery.isPending ||
    nodesQuery.isPending ||
    milestonesQuery.isPending ||
    themesQuery.isPending;
  const error =
    summaryQuery.error ||
    nodesQuery.error ||
    milestonesQuery.error ||
    themesQuery.error;

  useEffect(() => {
    if (!error || toastedError.current === error) return;
    toastedError.current = error;
    if (shouldToastApiError(error)) {
      toast.error(getApiErrorMessage(error, "加载图鉴失败"));
    }
  }, [error, toast]);

  const summary = summaryQuery.data ?? null;
  const nodes = nodesQuery.data?.nodes ?? [];
  const total = nodesQuery.data?.total ?? 0;
  const milestones = milestonesQuery.data?.milestones ?? [];
  const themes = themesQuery.data?.albums ?? [];

  const constellations = useMemo(
    () => milestones.filter((item) => item.category === "constellation"),
    [milestones]
  );
  const regularMilestones = useMemo(
    () => milestones.filter((item) => item.category !== "constellation"),
    [milestones]
  );

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

