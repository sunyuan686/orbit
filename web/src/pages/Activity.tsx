import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  TYPE_LABEL,
  fetchActivityDayEntries,
  fetchActivityStats,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  type ActivityDayEntry,
  type ActivityStats,
} from "../lib/api";
import { formatActivityDateLabel } from "../lib/activityHeatmap";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import { ActivityHeatmap } from "../components/ActivityHeatmap";

function entryLabel(entry: ActivityDayEntry): string {
  return (
    entry.title?.trim() ||
    (entry.entryDate ? formatDate(entry.entryDate) : "无标题")
  );
}

export function ActivityPage() {
  const toast = useToast();
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayEntries, setDayEntries] = useState<ActivityDayEntry[]>([]);
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    setPageTitle("记录活动");
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchActivityStats(365)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载活动统计失败"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [toast]);

  useEffect(() => {
    if (!selectedDate) {
      setDayEntries([]);
      return;
    }

    let cancelled = false;
    setDayLoading(true);
    void fetchActivityDayEntries(selectedDate)
      .then((data) => {
        if (!cancelled) setDayEntries(data.entries);
      })
      .catch((err) => {
        if (cancelled) return;
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载当日记录失败"));
        }
      })
      .finally(() => {
        if (!cancelled) setDayLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, toast]);

  return (
    <div className="orbit-content orbit-activity" data-page="activity">
      <header className="orbit-activity-header">
        <div>
          <h1 className="orbit-page-title">记录活动</h1>
          <p className="orbit-muted orbit-activity-subtitle">
            日记、时间线、留言与信件 — 看看我们一起记录了多久
          </p>
        </div>
      </header>

      {loading ? (
        <p className="orbit-muted">加载中…</p>
      ) : !stats ? (
        <p className="orbit-muted">暂无数据</p>
      ) : (
        <>
          <section className="orbit-activity-summary" aria-label="活动概览">
            <div className="orbit-activity-stat">
              <span className="orbit-activity-stat-value">{stats.streak.current}</span>
              <span className="orbit-activity-stat-label">连续记录（天）</span>
            </div>
            <div className="orbit-activity-stat">
              <span className="orbit-activity-stat-value">{stats.streak.longest}</span>
              <span className="orbit-activity-stat-label">最长连续</span>
            </div>
            <div className="orbit-activity-stat">
              <span className="orbit-activity-stat-value">{stats.summary.activeDays}</span>
              <span className="orbit-activity-stat-label">今年活跃天</span>
            </div>
            <div className="orbit-activity-stat">
              <span className="orbit-activity-stat-value">{stats.summary.totalEntries}</span>
              <span className="orbit-activity-stat-label">近 {stats.summary.rangeDays} 天篇数</span>
            </div>
          </section>

          <section className="orbit-activity-chart" aria-labelledby="activity-heatmap-title">
            <h2 className="orbit-section-title" id="activity-heatmap-title">
              近一年
            </h2>
            <ActivityHeatmap
              days={stats.days}
              selectedDate={selectedDate}
              onSelectDate={(date) =>
                setSelectedDate((current) => (current === date ? null : date))
              }
            />
          </section>

          {selectedDate && (
            <section className="orbit-activity-day" aria-labelledby="activity-day-title">
              <h2 className="orbit-section-title" id="activity-day-title">
                {formatActivityDateLabel(selectedDate)}
              </h2>
              {dayLoading ? (
                <p className="orbit-muted">加载中…</p>
              ) : dayEntries.length === 0 ? (
                <p className="orbit-muted">这一天没有记录</p>
              ) : (
                <ul className="orbit-list-plain orbit-entry-list">
                  {dayEntries.map((item) => (
                    <li key={item.id}>
                      <Link to={`/${item.type}/${item.id}`} className="orbit-entry-card">
                        <span className="orbit-entry-card-main">
                          <span className="orbit-home-recent-type">
                            {TYPE_LABEL[item.type] ?? item.type}
                          </span>
                          <span className="orbit-entry-title orbit-entry-title-truncate">
                            {entryLabel(item)}
                          </span>
                          {item.author && (
                            <span className="orbit-entry-author">{item.author}</span>
                          )}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
