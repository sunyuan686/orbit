import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  TYPE_LABEL,
  celebrateMemoryMilestones,
  fetchActivityStats,
  fetchMemoryMilestones,
  fetchMemorySky,
  fetchMemorySummary,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  type MemorySkyDay,
  type MemorySkyEntry,
  type MemorySummary,
  type MilestoneUnlock,
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../hooks/useToast";
import { MilestoneCelebrate } from "../components/MilestoneCelebrate";
import { ActivityHeatmap } from "../components/ActivityHeatmap";
import { Container, Section, Card, CardBody, Stack } from "../components/ui";

interface DayCluster {
  date: string;
  count: number;
  weight: number;
  dominantType: string;
  entries: MemorySkyEntry[];
  /** 星在天幕里的坐标（百分比）：x 按时间从左到右，y 伪随机散布 */
  x: number;
  y: number;
  /** 闪烁相位，稳定伪随机 */
  phase: number;
}

interface SkyModel {
  days: DayCluster[];
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

function entryLabel(entry: MemorySkyEntry): string {
  return entry.title?.trim() || entry.snippet || formatDate(entry.occurredAt);
}

const DAY_MS = 86_400_000;

/**
 * 斥力松弛：基于真实物理画布比例，把挤在一起的星推开到舒适间距。
 */
function relaxOverlaps(days: DayCluster[], pxX = 3.6, pxY = 3.2) {
  const MIN_DIST = 22; // 像素级最小间距（30 颗星拥有充足留白，22px 保证每颗星从容呼吸）
  for (let iter = 0; iter < 6; iter++) {
    for (let i = 0; i < days.length; i++) {
      for (let j = i + 1; j < days.length; j++) {
        const a = days[i];
        const b = days[j];
        let dx = (a.x - b.x) * pxX;
        let dy = (a.y - b.y) * pxY;
        let dist = Math.hypot(dx, dy);
        if (dist >= MIN_DIST) continue;
        if (dist < 0.01) {
          dx = hash01(a.date + b.date) - 0.5;
          dy = 1;
          dist = Math.hypot(dx, dy);
        }
        const push = (MIN_DIST - dist) / 2 / dist;
        a.x = Math.min(96, Math.max(4, a.x + (dx * push * 0.7) / pxX));
        b.x = Math.min(96, Math.max(4, b.x - (dx * push * 0.7) / pxX));
        a.y = Math.min(88, Math.max(14, a.y + (dy * push * 0.9) / pxY));
        b.y = Math.min(88, Math.max(14, b.y - (dy * push * 0.9) / pxY));
      }
    }
  }
}

/**
 * 从全量日子中精选 28~32 颗高光与温情漫游星辰：
 * 1. 优先保全重要高光日（多瞬间与里程碑）；
 * 2. 分段等距随机采样各时期的岁月瞬间（实现随机回忆与时空偶遇）；
 * 3. 严格控制全屏数量在 30 颗左右，彻底消除密集感与拥挤。
 */
function sampleConstellation(
  days: MemorySkyDay[],
  target = 30,
  seed = 0
): MemorySkyDay[] {
  if (days.length <= target) return days;
  const priority = days.filter((d) => d.count >= 3 || d.weight >= 2);
  const prioritySet = new Set(priority.map((d) => d.date));
  const remaining = days.filter((d) => !prioritySet.has(d.date));

  let picked: MemorySkyDay[] = [];
  if (priority.length >= target) {
    // 高光日过多时，分桶等距抽样 target 颗，确保全时间段覆盖
    const bucketSize = priority.length / target;
    for (let i = 0; i < target; i++) {
      const idx = Math.min(priority.length - 1, Math.floor(i * bucketSize));
      picked.push(priority[idx]);
    }
  } else {
    picked = [...priority];
    const needed = target - picked.length;
    if (needed > 0 && remaining.length > 0) {
      const bucketSize = remaining.length / needed;
      for (let i = 0; i < needed; i++) {
        const start = Math.floor(i * bucketSize);
        const end = Math.min(remaining.length, Math.floor((i + 1) * bucketSize));
        // 使用种子加权取样，实现随机漫步偶遇回忆
        const offset = hash01(`${seed}-${i}`, 79);
        const idx = Math.min(
          end - 1,
          start + Math.floor(offset * Math.max(1, end - start))
        );
        picked.push(remaining[idx]);
      }
    }
  }

  return picked.sort((a, b) => a.date.localeCompare(b.date));
}

function buildSky(rawDays: MemorySkyDay[], seed = 0): SkyModel {
  if (rawDays.length === 0) return { days: [] };

  const sampledDays = sampleConstellation(rawDays, 30, seed);

  const days: DayCluster[] = sampledDays.map((day) => ({
    ...day,
    x: 0,
    y: 16 + hash01(day.date) * 66,
    phase: hash01(day.date, 7),
  }));

  const minT = Date.parse(rawDays[0].date);
  const maxT = Date.parse(rawDays[rawDays.length - 1].date);
  const span = Math.max(maxT - minT, DAY_MS);
  const N = days.length;

  for (let i = 0; i < N; i++) {
    const day = days[i];
    const tTime = (Date.parse(day.date) - minT) / span;
    const tRank = N > 1 ? i / (N - 1) : 0.5;
    // 50% 时间线性 + 50% 序号分位数，严格保序（左旧右新）同时平滑舒展
    const tBlend = 0.5 * tTime + 0.5 * tRank;
    const jitter = (hash01(day.date, 13) - 0.5) * 2.4;
    day.x = Math.min(96, Math.max(4, 4 + tBlend * 92 + jitter));
    // 避让右上角圆月区域
    if (day.x > 84 && day.y < 28) {
      day.y = 28 + hash01(day.date, 11) * 54;
    }
  }

  // 物理碰撞松弛（30 颗星在 100% 容器内，间距极其充裕舒朗）
  relaxOverlaps(days, 3.6, 3.2);

  return { days };
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
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
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

  const dismissCelebrate = useCallback(() => {
    setCelebrateItems([]);
  }, []);

  useEffect(() => {
    setPageTitle("恋爱记忆");
  }, []);

  const summaryQuery = useQuery({
    queryKey: queryKeys.memorySummary,
    queryFn: fetchMemorySummary,
  });
  const skyQuery = useQuery({
    queryKey: queryKeys.memorySky,
    queryFn: fetchMemorySky,
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
    summaryQuery.isPending || skyQuery.isPending || milestonesQuery.isPending;
  const error =
    summaryQuery.error || skyQuery.error || milestonesQuery.error;

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
  const milestones = milestonesQuery.data?.milestones ?? [];
  const skyDays = skyQuery.data?.days;
  const [skySeed] = useState(() => Math.floor(Math.random() * 10000));
  const sky = useMemo(() => buildSky(skyDays ?? [], skySeed), [skyDays, skySeed]);
  const litDays = skyQuery.data?.totalDays ?? sky.days.length;
  const selectedDay = useMemo(
    () => sky.days.find((day) => day.date === selectedDate) ?? null,
    [sky, selectedDate]
  );

  return (
    <Container size="wide" className="orbit-memory" data-page="memories">
      {celebrateItems.length > 0 ? (
        <MilestoneCelebrate items={celebrateItems} onDone={dismissCelebrate} />
      ) : null}

      <Stack gap="xl">
        <MemoryHeader summary={summary} />

        {loading ? (
          <p className="orbit-muted">点亮星图中…</p>
        ) : sky.days.length === 0 ? (
          <p className="orbit-muted">
            还没有瞬间。去写一篇日记或一封信，第一颗星就亮了。
          </p>
        ) : (
          <>
            {/* 1. 浪漫天幕星空 */}
            <Section
              title="记忆星空"
              description={
                litDays > 0 ? `我们一起点亮了 ${litDays} 个日子` : undefined
              }
            >
              <div className="orbit-memory-sky" aria-label="按日星图">
                <div className="orbit-memory-sky-moon" aria-hidden />

                <div
                  className="orbit-memory-field"
                  onClick={() => setSelectedDate(null)}
                >
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
                      {selectedDay.entries.map((entry) => (
                        <li key={entry.id}>
                          <Link to={entry.link} className="orbit-memory-focus-entry">
                            <span
                              className={`orbit-memory-focus-dot orbit-memory-day-star--${entry.contentType}`}
                              aria-hidden
                            />
                            <span className="orbit-memory-focus-type">
                              {TYPE_LABEL[entry.contentType] ?? entry.contentType}
                            </span>
                            <span className="orbit-entry-title orbit-entry-title-truncate">
                              {entryLabel(entry)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
              </div>
            </Section>

            {/* 2. 相伴成就与里程碑 */}
            {milestones.length > 0 ? (
              <Section
                title={`相伴成就与里程碑 · ${milestones.length}`}
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

            {/* 3. 总体记录热力图 */}
            {activityQuery.data?.days ? (
              <Section
                title="总体记录热力"
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

