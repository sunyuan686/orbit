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

function parseDateString(str: string): Date | null {
  if (!str) return null;
  const s = str.trim();

  // 1. YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    const y = parseInt(s.slice(0, 4), 10);
    const m = parseInt(s.slice(4, 6), 10);
    const d = parseInt(s.slice(6, 8), 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, m - 1, d);
      if (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
      ) {
        return date;
      }
    }
  }

  // 2. YYYY年M月D日 or YYYY年MM月DD日
  const cnMatch = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/);
  if (cnMatch) {
    const y = parseInt(cnMatch[1], 10);
    const m = parseInt(cnMatch[2], 10);
    const d = parseInt(cnMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      const date = new Date(y, m - 1, d);
      if (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
      ) {
        return date;
      }
    }
  }

  // 3. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
  const parts = s.split(/[-/.]/);
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (
      !isNaN(y) &&
      !isNaN(m) &&
      !isNaN(d) &&
      y > 1000 &&
      m >= 1 &&
      m <= 12 &&
      d >= 1 &&
      d <= 31
    ) {
      const date = new Date(y, m - 1, d);
      if (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
      ) {
        return date;
      }
    }
  }

  return null;
}

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
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("day");

  const selected = parseIsoDate(value);

  // Month navigation state
  const [month, setMonth] = useState<Date>(() => selected ?? new Date());
  // Input string state
  const [inputText, setInputText] = useState(value);

  // Year range start for "year" grid mode (12 years per page)
  const [yearPageStart, setYearPageStart] = useState<number>(() => {
    const y = (selected ?? new Date()).getFullYear();
    return Math.floor(y / 12) * 12;
  });

  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const updateTouch = () => {
      setIsTouch(
        window.matchMedia("(pointer: coarse)").matches ||
          "ontouchstart" in window ||
          navigator.maxTouchPoints > 0 ||
          window.innerWidth <= 640
      );
    };
    updateTouch();
    window.addEventListener("resize", updateTouch);
    return () => window.removeEventListener("resize", updateTouch);
  }, []);

  // Lock body scrolling when open on mobile
  useEffect(() => {
    if (!open) return;
    if (isTouch || window.innerWidth <= 640) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [open, isTouch]);

  // Sync inputText and month when value prop changes externally
  useEffect(() => {
    setInputText(value);
    const date = parseIsoDate(value);
    if (date) {
      setMonth(date);
      setYearPageStart(Math.floor(date.getFullYear() / 12) * 12);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
      setViewMode("day");
      // Validate on blur / close
      if (inputText.trim() === "" && allowClear) {
        onChange("");
      } else if (value) {
        setInputText(value);
      } else {
        setInputText("");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setViewMode("day");
        setInputText(value || "");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, inputText, value, allowClear, onChange]);

  function selectDate(date: Date) {
    const iso = toIsoDate(date);
    onChange(iso);
    setInputText(iso);
    setMonth(date);
    setOpen(false);
    setViewMode("day");
  }

  function handleInputChange(text: string) {
    setInputText(text);
    const parsed = parseDateString(text);
    if (parsed) {
      const iso = toIsoDate(parsed);
      onChange(iso);
      setMonth(parsed);
      setYearPageStart(Math.floor(parsed.getFullYear() / 12) * 12);
    }
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const parsed = parseDateString(inputText);
      if (parsed) {
        selectDate(parsed);
      } else if (inputText.trim() === "" && allowClear) {
        onChange("");
        setOpen(false);
        setViewMode("day");
      } else {
        setInputText(value || "");
        setOpen(false);
        setViewMode("day");
      }
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setInputText("");
    setOpen(false);
    setViewMode("day");
  }

  function handleTriggerClick() {
    if (!open) {
      setOpen(true);
      if (!isTouch) {
        inputRef.current?.focus();
      }
    } else {
      setOpen(false);
      setViewMode("day");
    }
  }

  const currentYear = month.getFullYear();
  const currentMonthIdx = month.getMonth();

  return (
    <div
      ref={rootRef}
      className={`orbit-date-picker ${variant === "inline" ? "orbit-date-picker--inline" : ""} ${className}`.trim()}
    >
      <div
        className={`orbit-date-picker-trigger ${open ? "orbit-date-picker-trigger--open" : ""}`}
        onClick={handleTriggerClick}
      >
        <CalendarIcon size="sm" className="orbit-date-picker-trigger-icon" />
        <input
          ref={inputRef}
          id={triggerId}
          type="text"
          readOnly={isTouch}
          inputMode={isTouch ? "none" : "text"}
          className="orbit-date-picker-input"
          value={inputText}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
          onFocus={() => {
            if (!isTouch) setOpen(true);
          }}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
        />
        {allowClear && value ? (
          <button
            type="button"
            className="orbit-date-picker-clear-btn"
            aria-label="清除日期"
            title="清除日期"
            onClick={handleClear}
          >
            <CloseIcon size="sm" />
          </button>
        ) : null}
      </div>

      {open ? (
        <>
          <div
            className="orbit-date-picker-backdrop"
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              setViewMode("day");
              if (inputText.trim() === "" && allowClear) {
                onChange("");
              } else if (value) {
                setInputText(value);
              } else {
                setInputText("");
              }
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
              showOutsideDays
              fixedWeeks
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
                  setInputText("");
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
