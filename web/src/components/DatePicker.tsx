import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { zhCN } from "date-fns/locale";
import { formatAnniversaryCn } from "../lib/api";
import { parseIsoDate, toIsoDate } from "../lib/dateInput";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "./OrbitIcons";
import "react-day-picker/style.css";

export type DatePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  allowClear?: boolean;
  "aria-label"?: string;
};

export function DatePicker({
  id,
  value,
  onChange,
  className = "",
  placeholder = "选择日期",
  allowClear = false,
  "aria-label": ariaLabel = "选择日期",
}: DatePickerProps) {
  const fallbackId = useId();
  const triggerId = id ?? fallbackId;
  const popoverId = `${triggerId}-popover`;
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = parseIsoDate(value);
  const defaultMonth = selected ?? new Date();

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function selectDate(date: Date) {
    onChange(toIsoDate(date));
    setOpen(false);
  }

  const displayValue = value ? formatAnniversaryCn(value) : placeholder;

  return (
    <div ref={rootRef} className={`orbit-date-picker ${className}`.trim()}>
      <button
        id={triggerId}
        type="button"
        className="orbit-date-picker-trigger"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
      >
        <CalendarIcon size="sm" className="orbit-date-picker-trigger-icon" />
        <span
          className={
            value
              ? "orbit-date-picker-trigger-value"
              : "orbit-date-picker-trigger-placeholder"
          }
        >
          {displayValue}
        </span>
      </button>

      {open ? (
        <div
          id={popoverId}
          role="dialog"
          aria-label={ariaLabel}
          className="orbit-date-picker-popover"
        >
          <DayPicker
            mode="single"
            locale={zhCN}
            navLayout="around"
            defaultMonth={defaultMonth}
            selected={selected}
            onSelect={(date) => {
              if (date) selectDate(date);
            }}
            showOutsideDays
            fixedWeeks
            className="orbit-date-picker-calendar"
            components={{
              Chevron: ({ orientation }) =>
                orientation === "left" ? (
                  <ChevronLeftIcon size="sm" />
                ) : (
                  <ChevronRightIcon size="sm" />
                ),
            }}
          />

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
                }}
              >
                清除
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
