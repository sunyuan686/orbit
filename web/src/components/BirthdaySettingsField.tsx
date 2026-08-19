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
  defaultLunarDraft,
  defaultSolarDraft,
  lunarDayLabel,
  lunarMonthLabel,
  maxDayForBirthday,
  resolveRemindCalendar,
  type BirthdayCalendar,
  type BirthdayProfile,
  type LunarBirthday,
  type SolarBirthday,
} from "@orbit/shared";
import { useToast } from "../hooks/useToast";
import { Button, Select } from "./ui";

function toDraft(birthday: AccountBirthday | null): BirthdayProfile | null {
  if (!birthday) return null;
  return {
    solar: birthday.solar
      ? { month: birthday.solar.month, day: birthday.solar.day }
      : null,
    lunar: birthday.lunar
      ? {
          month: birthday.lunar.month,
          day: birthday.lunar.day,
          leapMonth: birthday.lunar.leapMonth,
        }
      : null,
    remindCalendar: birthday.remindCalendar,
  };
}

function DaySelect({
  calendar,
  month,
  day,
  onChange,
}: {
  calendar: BirthdayCalendar;
  month: number;
  day: number;
  onChange: (day: number) => void;
}) {
  const dayMax = maxDayForBirthday(calendar, month);
  const dayOptions = useMemo(
    () => Array.from({ length: dayMax }, (_, i) => i + 1),
    [dayMax]
  );
  return (
    <Select
      aria-label="日"
      value={day}
      onChange={(event) => onChange(Number(event.target.value))}
      className="orbit-birthday-select"
    >
      {dayOptions.map((value) => (
        <option key={value} value={value}>
          {calendar === "lunar" ? lunarDayLabel(value) : `${value} 日`}
        </option>
      ))}
    </Select>
  );
}

function MonthSelect({
  calendar,
  month,
  onChange,
}: {
  calendar: BirthdayCalendar;
  month: number;
  onChange: (month: number) => void;
}) {
  return (
    <Select
      aria-label="月"
      value={month}
      onChange={(event) => onChange(Number(event.target.value))}
      className="orbit-birthday-select"
    >
      {Array.from({ length: 12 }, (_, i) => i + 1).map((value) => (
        <option key={value} value={value}>
          {calendar === "lunar" ? lunarMonthLabel(value) : `${value} 月`}
        </option>
      ))}
    </Select>
  );
}

export function BirthdaySettingsField() {
  const toast = useToast();
  const [saved, setSaved] = useState<BirthdayProfile | null>(null);
  const [draft, setDraft] = useState<BirthdayProfile | null>(null);
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
  const hasAny = Boolean(draft?.solar || draft?.lunar);
  const bothSet = Boolean(draft?.solar && draft?.lunar);

  function patchDraft(
    updater: (current: BirthdayProfile) => BirthdayProfile
  ) {
    setDraft((current) => {
      const base = current ?? defaultBirthdayDraft();
      const next = updater(base);
      return {
        ...next,
        remindCalendar: resolveRemindCalendar(
          next.solar,
          next.lunar,
          next.remindCalendar
        ),
      };
    });
  }

  function enableBirthday() {
    setDraft(defaultBirthdayDraft());
  }

  function clearAll() {
    setDraft(null);
  }

  function setSolar(solar: SolarBirthday | null) {
    patchDraft((current) => ({ ...current, solar }));
  }

  function setLunar(lunar: LunarBirthday | null) {
    patchDraft((current) => ({ ...current, lunar }));
  }

  function setSolarMonth(month: number) {
    patchDraft((current) => {
      if (!current.solar) return current;
      const maxDay = maxDayForBirthday("solar", month);
      return {
        ...current,
        solar: {
          month,
          day: Math.min(current.solar.day, maxDay),
        },
      };
    });
  }

  function setSolarDay(day: number) {
    patchDraft((current) =>
      current.solar ? { ...current, solar: { ...current.solar, day } } : current
    );
  }

  function setLunarMonth(month: number) {
    patchDraft((current) => {
      if (!current.lunar) return current;
      const maxDay = maxDayForBirthday("lunar", month);
      return {
        ...current,
        lunar: {
          ...current.lunar,
          month,
          day: Math.min(current.lunar.day, maxDay),
        },
      };
    });
  }

  function setLunarDay(day: number) {
    patchDraft((current) =>
      current.lunar ? { ...current, lunar: { ...current.lunar, day } } : current
    );
  }

  function setLeapMonth(leapMonth: boolean) {
    patchDraft((current) =>
      current.lunar
        ? { ...current, lunar: { ...current.lunar, leapMonth } }
        : current
    );
  }

  function setRemindCalendar(remindCalendar: BirthdayCalendar) {
    patchDraft((current) => ({ ...current, remindCalendar }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const payload =
        draft && (draft.solar || draft.lunar)
          ? {
              solar: draft.solar,
              lunar: draft.lunar,
              remindCalendar: resolveRemindCalendar(
                draft.solar,
                draft.lunar,
                draft.remindCalendar
              ),
            }
          : null;
      const profile = await updateAccountBirthday(payload);
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
    <form
      className="orbit-settings-stacked-form"
      onSubmit={(e) => void handleSave(e)}
    >
      <div className="orbit-settings-field-control">
        {draft == null ? (
          dirty ? (
            <div className="orbit-birthday-editor">
              <p className="orbit-muted">将清除已保存的生日</p>
              <div className="orbit-settings-inline-form">
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={saving}
                  loading={saving}
                >
                  确认清除
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setDraft(saved)}
                >
                  取消
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={enableBirthday}
            >
              设置生日
            </Button>
          )
        ) : (
          <div className="orbit-birthday-editor">
            <div className="orbit-birthday-side">
              <span className="orbit-birthday-side-label">公历</span>
              {draft.solar ? (
                <div className="orbit-birthday-date-row">
                  <MonthSelect
                    calendar="solar"
                    month={draft.solar.month}
                    onChange={setSolarMonth}
                  />
                  <DaySelect
                    calendar="solar"
                    month={draft.solar.month}
                    day={draft.solar.day}
                    onChange={setSolarDay}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => setSolar(null)}
                  >
                    清除
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setSolar(defaultSolarDraft())}
                >
                  + 添加公历
                </Button>
              )}
            </div>

            <div className="orbit-birthday-side">
              <span className="orbit-birthday-side-label">农历</span>
              {draft.lunar ? (
                <div className="orbit-birthday-date-row">
                  <MonthSelect
                    calendar="lunar"
                    month={draft.lunar.month}
                    onChange={setLunarMonth}
                  />
                  <DaySelect
                    calendar="lunar"
                    month={draft.lunar.month}
                    day={draft.lunar.day}
                    onChange={setLunarDay}
                  />
                  <label className="orbit-birthday-leap">
                    <input
                      type="checkbox"
                      checked={draft.lunar.leapMonth}
                      onChange={(event) => setLeapMonth(event.target.checked)}
                    />
                    <span>闰月</span>
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => setLunar(null)}
                  >
                    清除
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => setLunar(defaultLunarDraft())}
                >
                  + 添加农历
                </Button>
              )}
            </div>

            {hasAny ? (
              <div className="orbit-birthday-side">
                <span className="orbit-birthday-side-label">提醒按</span>
                {bothSet ? (
                  <div
                    className="orbit-birthday-calendar-switch"
                    role="group"
                    aria-label="提醒历法"
                  >
                    <button
                      type="button"
                      className={`orbit-birthday-calendar-option${draft.remindCalendar === "lunar" ? " is-active" : ""}`}
                      aria-pressed={draft.remindCalendar === "lunar"}
                      onClick={() => setRemindCalendar("lunar")}
                    >
                      农历
                    </button>
                    <button
                      type="button"
                      className={`orbit-birthday-calendar-option${draft.remindCalendar === "solar" ? " is-active" : ""}`}
                      aria-pressed={draft.remindCalendar === "solar"}
                      onClick={() => setRemindCalendar("solar")}
                    >
                      公历
                    </button>
                  </div>
                ) : (
                  <span className="orbit-muted">
                    {draft.solar ? "公历" : "农历"}
                  </span>
                )}
              </div>
            ) : null}

            <div className="orbit-settings-inline-form" style={{ marginTop: "0.5rem" }}>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={saving || !dirty}
                loading={saving}
              >
                保存生日
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={saving}
                onClick={clearAll}
              >
                全部清除
              </Button>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}
