import { useMemo } from "react";
import type { ActivityDayCount } from "../lib/api";
import {
  activityLevel,
  buildWeekGrid,
  formatActivityCountLabel,
  formatActivityDateLabel,
  sliceRecentDays,
} from "../lib/activityHeatmap";

export interface ActivityHeatmapProps {
  days: ActivityDayCount[];
  /** 仅展示最近 N 天（首页迷你条） */
  recentDays?: number;
  compact?: boolean;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  className?: string;
}

export function ActivityHeatmap({
  days,
  recentDays,
  compact = false,
  selectedDate = null,
  onSelectDate,
  className = "",
}: ActivityHeatmapProps) {
  const visibleDays = useMemo(
    () => (recentDays ? sliceRecentDays(days, recentDays) : days),
    [days, recentDays]
  );
  const weeks = useMemo(() => buildWeekGrid(visibleDays), [visibleDays]);

  const cellClass = compact
    ? "orbit-activity-cell orbit-activity-cell--compact"
    : "orbit-activity-cell";

  return (
    <div
      className={`orbit-activity-heatmap${compact ? " orbit-activity-heatmap--compact" : ""}${className ? ` ${className}` : ""}`}
      role="img"
      aria-label="写作活动热力图"
    >
      <div className="orbit-activity-weeks">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="orbit-activity-week">
            {week.map((day, dayIndex) => {
              if (!day) {
                return (
                  <span
                    key={`${weekIndex}-${dayIndex}`}
                    className={`${cellClass} orbit-activity-cell--empty`}
                    aria-hidden
                  />
                );
              }

              const level = activityLevel(day.count);
              const isSelected = selectedDate === day.date;
              const title = `${formatActivityDateLabel(day.date)}：${formatActivityCountLabel(day.count)}`;

              if (onSelectDate) {
                return (
                  <button
                    key={day.date}
                    type="button"
                    className={`${cellClass} orbit-activity-cell--level-${level}${isSelected ? " orbit-activity-cell--selected" : ""}`}
                    title={title}
                    aria-label={title}
                    aria-pressed={isSelected}
                    onClick={() => onSelectDate(day.date)}
                  />
                );
              }

              return (
                <span
                  key={day.date}
                  className={`${cellClass} orbit-activity-cell--level-${level}`}
                  title={title}
                  aria-label={title}
                />
              );
            })}
          </div>
        ))}
      </div>
      {!compact && (
        <div className="orbit-activity-legend" aria-hidden>
          <span>少</span>
          <span className="orbit-activity-cell orbit-activity-cell--level-0" />
          <span className="orbit-activity-cell orbit-activity-cell--level-1" />
          <span className="orbit-activity-cell orbit-activity-cell--level-2" />
          <span className="orbit-activity-cell orbit-activity-cell--level-3" />
          <span className="orbit-activity-cell orbit-activity-cell--level-4" />
          <span>多</span>
        </div>
      )}
    </div>
  );
}
