import { useEffect, useMemo, useState } from "react";
import {
  fetchAccountProfile,
  getApiErrorMessage,
  shouldToastApiError,
  updateAccountBirthday,
  type AccountBirthday,
} from "../lib/api";
import {
  birthdayEquals,
  defaultBirthdayDraft,
  lunarDayLabel,
  lunarMonthLabel,
  maxDayForBirthday,
  type BirthdayCalendar,
  type BirthdayValue,
} from "../lib/birthday";
import { useToast } from "../lib/useToast";

function toDraft(birthday: AccountBirthday | null): BirthdayValue | null {
  if (!birthday) return null;
  return {
    calendar: birthday.calendar,
    month: birthday.month,
    day: birthday.day,
    leapMonth: birthday.leapMonth,
  };
}

export function BirthdaySettingsField() {
  const toast = useToast();
  const [saved, setSaved] = useState<BirthdayValue | null>(null);
  const [draft, setDraft] = useState<BirthdayValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchAccountProfile();
        if (cancelled) return;
        const next = toDraft(profile.birthday);
        setSaved(next);
        setDraft(next);
      } catch (err) {
        if (!cancelled && shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载生日失败"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const dirty = !birthdayEquals(draft, saved);
  const dayMax = draft ? maxDayForBirthday(draft.calendar, draft.month) : 31;

  const dayOptions = useMemo(
    () => Array.from({ length: dayMax }, (_, i) => i + 1),
    [dayMax]
  );

  function setCalendar(calendar: BirthdayCalendar) {
    setDraft((current) => {
      const base = current ?? defaultBirthdayDraft(calendar);
      const month = base.month;
      const maxDay = maxDayForBirthday(calendar, month);
      return {
        calendar,
        month,
        day: Math.min(base.day, maxDay),
        leapMonth: calendar === "lunar" ? base.leapMonth : false,
      };
    });
  }

  function setMonth(month: number) {
    setDraft((current) => {
      if (!current) return current;
      const maxDay = maxDayForBirthday(current.calendar, month);
      return {
        ...current,
        month,
        day: Math.min(current.day, maxDay),
      };
    });
  }

  function setDay(day: number) {
    setDraft((current) => (current ? { ...current, day } : current));
  }

  function setLeapMonth(leapMonth: boolean) {
    setDraft((current) =>
      current && current.calendar === "lunar"
        ? { ...current, leapMonth }
        : current
    );
  }

  function enableBirthday() {
    setDraft(defaultBirthdayDraft("lunar"));
  }

  function clearBirthday() {
    setDraft(null);
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const profile = await updateAccountBirthday(draft);
      const next = toDraft(profile.birthday);
      setSaved(next);
      setDraft(next);
      toast.success(next ? "生日已更新" : "已清除生日");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更新失败"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="orbit-muted">加载中…</p>;
  }

  return (
    <form className="orbit-settings-stacked-form" onSubmit={(e) => void handleSave(e)}>
      <div className="orbit-settings-field-copy">
        <span className="orbit-settings-field-label">生日</span>
        <p className="orbit-settings-field-hint">
          支持公历或农历，供后续节日关心推送。仅自己可改。
        </p>
      </div>
      <div className="orbit-settings-field-control">
        {draft == null ? (
          dirty ? (
            <div className="orbit-birthday-editor">
              <p className="orbit-muted">将清除已保存的生日</p>
              <div className="orbit-settings-inline-form">
                <button
                  type="submit"
                  className="orbit-btn orbit-btn-sm orbit-settings-form-submit"
                  disabled={saving}
                >
                  {saving ? "保存中…" : "确认清除"}
                </button>
                <button
                  type="button"
                  className="orbit-btn orbit-btn-sm orbit-btn-ghost"
                  disabled={saving}
                  onClick={() => setDraft(saved)}
                >
                  取消
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="orbit-btn orbit-btn-sm"
              onClick={enableBirthday}
            >
              设置生日
            </button>
          )
        ) : (
          <div className="orbit-birthday-editor">
            <div
              className="orbit-birthday-calendar-switch"
              role="group"
              aria-label="历法"
            >
              <button
                type="button"
                className={`orbit-birthday-calendar-option${draft.calendar === "lunar" ? " is-active" : ""}`}
                aria-pressed={draft.calendar === "lunar"}
                onClick={() => setCalendar("lunar")}
              >
                农历
              </button>
              <button
                type="button"
                className={`orbit-birthday-calendar-option${draft.calendar === "solar" ? " is-active" : ""}`}
                aria-pressed={draft.calendar === "solar"}
                onClick={() => setCalendar("solar")}
              >
                公历
              </button>
            </div>

            <div className="orbit-birthday-date-row">
              <select
                className="orbit-input orbit-birthday-select"
                aria-label="月"
                value={draft.month}
                onChange={(event) => setMonth(Number(event.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                  <option key={month} value={month}>
                    {draft.calendar === "lunar"
                      ? lunarMonthLabel(month)
                      : `${month} 月`}
                  </option>
                ))}
              </select>
              <select
                className="orbit-input orbit-birthday-select"
                aria-label="日"
                value={draft.day}
                onChange={(event) => setDay(Number(event.target.value))}
              >
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {draft.calendar === "lunar"
                      ? lunarDayLabel(day)
                      : `${day} 日`}
                  </option>
                ))}
              </select>
              {draft.calendar === "lunar" ? (
                <label className="orbit-birthday-leap">
                  <input
                    type="checkbox"
                    checked={draft.leapMonth}
                    onChange={(event) => setLeapMonth(event.target.checked)}
                  />
                  <span>闰月</span>
                </label>
              ) : null}
            </div>

            <div className="orbit-settings-inline-form">
              <button
                type="submit"
                className="orbit-btn orbit-btn-sm orbit-settings-form-submit"
                disabled={saving || !dirty}
              >
                {saving ? "保存中…" : "保存"}
              </button>
              <button
                type="button"
                className="orbit-btn orbit-btn-sm orbit-btn-ghost"
                disabled={saving}
                onClick={clearBirthday}
              >
                清除
              </button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
