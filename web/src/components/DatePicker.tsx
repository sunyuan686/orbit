import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { parseIsoDate, toIsoDate } from "../lib/dateInput";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "./OrbitIcons";
import "react-day-picker/style.css";

export type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  allowClear?: boolean;
  variant?: "default" | "inline";
  "aria-label"?: string;
};

type ViewMode = "day" | "month" | "year";

const MONTH_NAMES = [
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

export function DatePicker({
  id,
  value,
  onChange,
  className = "",
  placeholder = "选择日期",
  allowClear = false,
  variant = "default",
  "aria-label": ariaLabel = "选择日期",
}: DatePickerProps) {
  const fallbackId = useId();
  const triggerId = id ?? fallbackId;
  const popoverId = `${triggerId}-popover`;
  const rootRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");

  const selected = parseIsoDate(value);

  // Month navigation state
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());

  // Year range start for "year" grid mode (12 years per page)
  const [yearPageStart, setYearPageStart] = useState<number>(() => {
    const y = (selected ?? new Date()).getFullYear();
    return Math.floor(y / 12) * 12;
  });

  // Lock body scrolling when open on mobile
  useEffect(() => {
    if (!open) return;
    const isMobile =
      window.innerWidth <= 640 ||
      window.matchMedia("(pointer: coarse)").matches;
    if (isMobile) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [open]);

  // Sync month when value prop changes externally
  useEffect(() => {
    const date = parseIsoDate(value);
    if (date) {
      setMonth(date);
      setYearPageStart(Math.floor(date.getFullYear() / 12) * 12);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
      setViewMode("day");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setViewMode("day");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectDate(date: Date) {
    const iso = toIsoDate(date);
    onChange(iso);
    setMonth(date);
    setOpen(false);
    setViewMode("day");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setViewMode("day");
  }

  function handleTriggerClick() {
    setOpen((prev) => !prev);
  }

  const currentYear = month.getFullYear();
  const currentMonthIdx = month.getMonth();

  return (
    <div
      ref={rootRef}
      className={`orbit-date-picker ${variant === "inline" ? "orbit-date-picker--inline" : ""} ${className}`.trim()}
    >
      {variant === "inline" ? (
        <button
          type="button"
          id={triggerId}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          aria-label={ariaLabel}
          className={`orbit-date-picker-trigger orbit-date-picker-trigger--inline ${open ? "orbit-date-picker-trigger--open" : ""}`}
          onClick={handleTriggerClick}
        >
          <CalendarIcon size="sm" className="orbit-date-picker-trigger-icon" />
          <span className="orbit-date-picker-text">{value || placeholder}</span>
        </button>
      ) : (
        <button
          type="button"
          id={triggerId}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          aria-label={ariaLabel}
          className={`orbit-date-picker-trigger ${open ? "orbit-date-picker-trigger--open" : ""}`}
          onClick={handleTriggerClick}
        >
          <CalendarIcon size="sm" className="orbit-date-picker-trigger-icon" />
          <span
            className={`orbit-date-picker-label ${value ? "orbit-date-picker-label--filled" : "orbit-date-picker-label--placeholder"}`}
          >
            {value || placeholder}
          </span>
          {allowClear && value ? (
            <span
              role="button"
              tabIndex={0}
              className="orbit-date-picker-clear-btn"
              aria-label="清除日期"
              title="清除日期"
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
            >
              <CloseIcon size="sm" />
            </span>
          ) : null}
        </button>
      )}

      {open ? (
        <>
          <div
            className="orbit-date-picker-backdrop"
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              setViewMode("day");
            }}
          />
          <div
            id={popoverId}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            className="orbit-date-picker-popover"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="orbit-date-picker-drawer-handle"
              aria-hidden="true"
            />
            {/* Header controls depending on viewMode */}
            <div className="orbit-date-picker-header">
            {viewMode === "day" && (
              <>
                <button
                  type="button"
                  className="orbit-date-picker-nav-btn"
                  title="上一月"
                  aria-label="上一月"
                  onClick={() =>
                    setMonth(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    )
                  }
                >
                  <ChevronLeftIcon size="sm" />
                </button>

                <div className="orbit-date-picker-caption-group">
                  <button
                    type="button"
                    className="orbit-date-picker-caption-btn"
                    onClick={() => {
                      setYearPageStart(Math.floor(currentYear / 12) * 12);
                      setViewMode("year");
                    }}
                  >
                    {currentYear}年
                  </button>
                  <button
                    type="button"
                    className="orbit-date-picker-caption-btn"
                    onClick={() => setViewMode("month")}
                  >
                    {currentMonthIdx + 1}月
                  </button>
                </div>

                <button
                  type="button"
                  className="orbit-date-picker-nav-btn"
                  title="下一月"
                  aria-label="下一月"
                  onClick={() =>
                    setMonth(
                      (prev) =>
                        new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    )
                  }
                >
                  <ChevronRightIcon size="sm" />
                </button>
              </>
            )}

            {viewMode === "year" && (
              <>
                <button
                  type="button"
                  className="orbit-date-picker-nav-btn"
                  title="上12年"
                  aria-label="上12年"
                  onClick={() => setYearPageStart((prev) => prev - 12)}
                >
                  <ChevronLeftIcon size="sm" />
                </button>

                <span className="orbit-date-picker-header-title">
                  {yearPageStart}年 - {yearPageStart + 11}年
                </span>

                <button
                  type="button"
                  className="orbit-date-picker-nav-btn"
                  title="下12年"
                  aria-label="下12年"
                  onClick={() => setYearPageStart((prev) => prev + 12)}
                >
                  <ChevronRightIcon size="sm" />
                </button>
              </>
            )}

            {viewMode === "month" && (
              <>
                <button
                  type="button"
                  className="orbit-date-picker-nav-btn"
                  title="上一年"
                  aria-label="上一年"
                  onClick={() =>
                    setMonth(
                      (prev) =>
                        new Date(prev.getFullYear() - 1, prev.getMonth(), 1)
                    )
                  }
                >
                  <ChevronLeftIcon size="sm" />
                </button>

                <button
                  type="button"
                  className="orbit-date-picker-caption-btn"
                  onClick={() => {
                    setYearPageStart(Math.floor(currentYear / 12) * 12);
                    setViewMode("year");
                  }}
                >
                  {currentYear}年
                </button>

                <button
                  type="button"
                  className="orbit-date-picker-nav-btn"
                  title="下一年"
                  aria-label="下一年"
                  onClick={() =>
                    setMonth(
                      (prev) =>
                        new Date(prev.getFullYear() + 1, prev.getMonth(), 1)
                    )
                  }
                >
                  <ChevronRightIcon size="sm" />
                </button>
              </>
            )}
          </div>

          {/* View Body */}
          {viewMode === "day" && (
            <DayPicker
              mode="single"
              locale={zhCN}
              month={month}
              onMonthChange={setMonth}
              selected={selected}
              onSelect={(date) => {
                if (date) selectDate(date);
              }}
              hideNavigation
              showOutsideDays={false}
              className="orbit-date-picker-calendar"
              components={{
                MonthCaption: () => <span style={{ display: "none" }} />,
              }}
            />
          )}

          {viewMode === "year" && (
            <div className="orbit-date-picker-grid-view">
              {Array.from({ length: 12 }, (_, i) => yearPageStart + i).map(
                (y) => (
                  <button
                    key={y}
                    type="button"
                    className={`orbit-date-picker-grid-cell ${
                      y === currentYear
                        ? "orbit-date-picker-grid-cell--active"
                        : ""
                    }`}
                    onClick={() => {
                      setMonth(new Date(y, currentMonthIdx, 1));
                      setViewMode("month");
                    }}
                  >
                    {y}年
                  </button>
                )
              )}
            </div>
          )}

          {viewMode === "month" && (
            <div className="orbit-date-picker-grid-view">
              {MONTH_NAMES.map((m, idx) => (
                <button
                  key={idx}
                  type="button"
                  className={`orbit-date-picker-grid-cell ${
                    idx === currentMonthIdx
                      ? "orbit-date-picker-grid-cell--active"
                      : ""
                  }`}
                  onClick={() => {
                    setMonth(new Date(currentYear, idx, 1));
                    setViewMode("day");
                  }}
                >
                  {m}
                </button>
              ))}
            </div>
          )}

          <div className="orbit-date-picker-footer">
            <button
              type="button"
              className="orbit-date-picker-footer-btn"
              onClick={() => selectDate(new Date())}
            >
              今天
            </button>
              {allowClear && value ? (
                <button
                  type="button"
                  className="orbit-date-picker-footer-btn orbit-date-picker-footer-btn--muted"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    setViewMode("day");
                  }}
                >
                  清除
                </button>
              ) : null}
          </div>
        </div>
      </>
    ) : null}
  </div>
);
}
