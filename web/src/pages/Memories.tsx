import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TYPE_LABEL,
  celebrateMemoryMilestones,
  fetchActivityStats,
  fetchMemoryMilestones,
  fetchMemoryNodes,
  fetchMemorySummary,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  type MemoryNode,
  type MemorySummary,
  type MilestoneUnlock,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../hooks/useToast";
import { MilestoneCelebrate } from "../components/MilestoneCelebrate";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { Container, Section, Card, CardBody, Stack } from "../components/ui";

const TYPE_TABS = [
  { key: "all", label: "全部" },
  { key: "letter", label: TYPE_LABEL.letter },
  { key: "diary", label: TYPE_LABEL.diary },
  { key: "message", label: TYPE_LABEL.message },
  { key: "timeline", label: TYPE_LABEL.timeline },
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
  const isFeatured = day.count >= 3;
  return (
    <button
      type="button"
      className={`orbit-memory-day-star orbit-memory-day-star--${size}${
        isFeatured ? " orbit-memory-day-star--featured" : ""
      }${active ? " is-active" : ""}`}
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

function MemoryHeader({ summary }: { summary: MemorySummary | null }) {
  return (
    <header className="orbit-memory-header">
      <div className="orbit-memory-header-main">
        <h1 className="orbit-page-title">恋爱记忆</h1>
        <p className="orbit-muted orbit-memory-subtitle">
          我们一起记下的光点，点一点就能回到那天
        </p>
      </div>
      {summary ? (
        <div className="orbit-memory-summary" aria-label="记忆概览">
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
        </div>
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

  const [typeKey, setTypeKey] = useState<(typeof TYPE_TABS)[number]["key"]>("all");
  const [year, setYear] = useState<number | "all">("all");

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2, current - 3];
  }, []);

  const dismissCelebrate = useCallback(() => {
    setCelebrateItems([]);
  }, []);

  useEffect(() => {
    setPageTitle("恋爱记忆");
  }, []);

  const nodeType = typeKey === "all" ? undefined : typeKey;
  const archiveParams = useMemo(
    () => ({
      limit: 60,
      offset: 0,
      type: nodeType,
      year: year === "all" ? undefined : year,
    }),
    [nodeType, year]
  );

  const summaryQuery = useQuery({
    queryKey: queryKeys.memorySummary,
    queryFn: fetchMemorySummary,
  });
  const skyNodesQuery = useQuery({
    queryKey: queryKeys.memoryNodes({ limit: 400, offset: 0 }),
    queryFn: () => fetchMemoryNodes({ limit: 400, offset: 0 }),
  });
  const archiveQuery = useQuery({
    queryKey: queryKeys.memoryNodes(archiveParams),
    queryFn: () => fetchMemoryNodes(archiveParams),
  });
  const milestonesQuery = useQuery({
    queryKey: queryKeys.memoryMilestones,
    queryFn: fetchMemoryMilestones,
  });
  const activityQuery = useQuery({
    queryKey: queryKeys.activityStats(365),
    queryFn: () => fetchActivityStats(365),
  });

  const loading =
    summaryQuery.isPending || skyNodesQuery.isPending || milestonesQuery.isPending;
  const error =
    summaryQuery.error || skyNodesQuery.error || milestonesQuery.error;

  useEffect(() => {
    if (!error || toastedError.current === error) return;
    toastedError.current = error;
    if (shouldToastApiError(error)) {
      toast.error(getApiErrorMessage(error, "加载记忆失败"));
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
  const skyNodes = skyNodesQuery.data?.nodes ?? [];
  const total = skyNodesQuery.data?.total ?? 0;

  const archiveNodes = archiveQuery.data?.nodes ?? [];
  const archiveTotal = archiveQuery.data?.total ?? 0;
  const archiveLoading = archiveQuery.isPending;

  const milestones = milestonesQuery.data?.milestones ?? [];

  const sky = useMemo(() => buildSky(skyNodes), [skyNodes]);
  const litDays = sky.days.length;
  const selectedDay = useMemo(
    () => sky.days.find((day) => day.date === selectedDate) ?? null,
    [sky, selectedDate]
  );

  return (
    <Container size="wide" className="orbit-memory" data-page="memories">
      {celebrateItems.length > 0 ? (
        <MilestoneCelebrate items={celebrateItems} onDone={dismissCelebrate} />
      ) : null}

      <Stack gap="2xl">
        <MemoryHeader summary={summary} />

        {loading ? (
          <p className="orbit-muted">点亮星图中…</p>
        ) : skyNodes.length === 0 ? (
          <p className="orbit-muted">
            还没有瞬间。去写一篇日记或一封信，第一颗星就亮了。
          </p>
        ) : (
          <>
            {/* 1. 浪漫天幕星空 */}
            <Section
              title="记忆星空"
              description={`我们一起点亮了 ${litDays} 个日子${
                total > skyNodes.length
                  ? `（展示最近 ${skyNodes.length} / 共 ${total} 篇）`
                  : ""
              }`}
            >
              <div className="orbit-memory-sky" aria-label="按日星图">
                <div className="orbit-memory-sky-moon" aria-hidden />

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

                {selectedDay && (
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
                )}
              </div>
            </Section>

            {/* 2. 记忆档案馆（亲密性：筛选控制器与档案列表紧密聚合） */}
            <Section
              title={`回忆档案${archiveLoading ? "" : ` · ${archiveTotal}`}`}
              description="按类型与年份检索我们共同留下的每一个瞬间"
            >
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
                      {tab.key !== "all" && summary?.byType[tab.key] != null
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

              {archiveLoading ? (
                <p className="orbit-muted">加载档案中…</p>
              ) : archiveNodes.length === 0 ? (
                <p className="orbit-muted">这个分类下还没有内容</p>
              ) : (
                <ul className="orbit-memory-card-grid">
                  {archiveNodes.map((node) => {
                    const customTitle = node.title?.trim() || null;
                    const snippet = node.snippet?.trim() || "";

                    return (
                      <li key={node.id}>
                        <Link
                          to={node.link}
                          className={`orbit-memory-card${node.coverImage ? " has-cover" : ""}`}
                        >
                          {node.coverImage ? (
                            <img
                              src={node.coverImage}
                              alt=""
                              className="orbit-memory-card-cover"
                              loading="lazy"
                            />
                          ) : null}
                          <div className="orbit-memory-card-body">
                            <div className="orbit-memory-card-header">
                              <span className="orbit-home-recent-type">
                                {TYPE_LABEL[node.contentType] ?? node.contentType}
                              </span>
                              {node.author && (
                                <span className="orbit-memory-card-author">@{node.author}</span>
                              )}
                            </div>
                            {customTitle ? (
                              <>
                                <h4 className="orbit-memory-card-title">{customTitle}</h4>
                                {snippet && (
                                  <p className="orbit-memory-card-snippet">{snippet}</p>
                                )}
                              </>
                            ) : (
                              <p className="orbit-memory-card-body-text">
                                {snippet || "（查看瞬间）"}
                              </p>
                            )}
                            <span className="orbit-memory-card-date">
                              {formatDate(node.occurredAt)}
                            </span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {/* 3. 相伴成就与里程碑 */}
            {milestones.length > 0 ? (
              <Section
                title={`相伴成就与里程碑 · ${milestones.length}`}
                description="记录共同走过的每一个重要时刻"
              >
                <ul className="orbit-memory-milestone-list">
                  {milestones.map((item) => (
                    <li
                      key={item.key}
                      className="orbit-memory-milestone-card"
                    >
                      <strong className="orbit-memory-milestone-title">{item.title}</strong>
                      <span className="orbit-memory-milestone-desc">{item.description}</span>
                      <span className="orbit-memory-milestone-date">
                        {formatDate(item.unlockedAt)} 点亮
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            {/* 4. 总体记录热力图 */}
            {activityQuery.data?.days ? (
              <Section
                title="总体记录热力"
                description="过去一年的记录轨迹"
              >
                <Card>
                  <CardBody>
                    <ActivityHeatmap days={activityQuery.data.days} />
                  </CardBody>
                </Card>
              </Section>
            ) : null}
          </>
        )}
      </Stack>
    </Container>
  );
}

export function MemoryAtlasPage() {
  return <Navigate to="/memories" replace />;
}

