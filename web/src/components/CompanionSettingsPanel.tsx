import { useEffect, useMemo, useState } from "react";
import {
  fetchCompanionSettings,
  formatDateTime,
  getApiErrorMessage,
  shouldToastApiError,
  updateCompanionSettings,
  type CompanionSettings,
} from "../lib/api";
import { useToast } from "../lib/useToast";

const DEFAULT_SETTINGS: CompanionSettings = {
  enabled: true,
  quietStart: "22:30",
  quietEnd: "08:30",
  pushStart: "09:00",
  pushEnd: "21:30",
  preferredTime: "09:00",
  nextAlarmAt: null,
};

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const headingId = `settings-section-${title}`;
  return (
    <section className="orbit-settings-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="orbit-settings-heading">
        {title}
      </h3>
      {children}
    </section>
  );
}

function normalizeAlarmTs(value: number): number {
  return value > 10_000_000_000 ? Math.floor(value / 1000) : value;
}

function isSameSettings(a: CompanionSettings, b: CompanionSettings): boolean {
  return (
    a.enabled === b.enabled &&
    a.quietStart === b.quietStart &&
    a.quietEnd === b.quietEnd &&
    a.pushStart === b.pushStart &&
    a.pushEnd === b.pushEnd &&
    a.preferredTime === b.preferredTime
  );
}

export function CompanionSettingsPanel() {
  const toast = useToast();
  const [saved, setSaved] = useState<CompanionSettings | null>(null);
  const [draft, setDraft] = useState<CompanionSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchCompanionSettings();
        if (cancelled) return;
        const next = { ...DEFAULT_SETTINGS, ...data };
        setSaved(next);
        setDraft(next);
      } catch (err) {
        if (!cancelled && shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载主动触达设置失败"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const dirty = useMemo(() => {
    if (!saved) return false;
    return !isSameSettings(saved, draft);
  }, [saved, draft]);

  const nextAlarmText = draft.nextAlarmAt
    ? formatDateTime(normalizeAlarmTs(draft.nextAlarmAt))
    : "尚未排程";

  function patchDraft(patch: Partial<CompanionSettings>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateCompanionSettings({
        enabled: draft.enabled,
        quietStart: draft.quietStart,
        quietEnd: draft.quietEnd,
        pushStart: draft.pushStart,
        pushEnd: draft.pushEnd,
        preferredTime: draft.preferredTime,
      });
      const merged = { ...DEFAULT_SETTINGS, ...next };
      setSaved(merged);
      setDraft(merged);
      toast.success("主动触达设置已保存");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存失败"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="orbit-muted orbit-settings-loading">加载主动触达设置…</p>;
  }

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">主动触达</h2>
        <p className="orbit-settings-panel-desc">
          配置陪伴提醒的触达窗口、安静时段与偏好时间。实际触发由 Durable Object Alarm 动态排程。
        </p>
      </header>

      <form onSubmit={(event) => void handleSave(event)}>
        <SettingsSection title="总开关">
          <div className="orbit-settings-fields">
            <div className="orbit-settings-field orbit-settings-field--stacked orbit-settings-field--editable">
              <div className="orbit-settings-field-copy">
                <span className="orbit-settings-field-label">主动陪伴</span>
                <p className="orbit-settings-field-hint">
                  开启后会在合适时间发送回忆、里程碑、温柔摘要与本周回顾。
                </p>
              </div>
              <div className="orbit-settings-field-control orbit-settings-field-control--block">
                <label className="orbit-settings-toggle">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => patchDraft({ enabled: event.target.checked })}
                  />
                  <span>{draft.enabled ? "已开启" : "已关闭"}</span>
                </label>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="触达时间">
          <div className="orbit-settings-fields">
            <div className="orbit-settings-field orbit-settings-field--stacked orbit-settings-field--editable">
              <div className="orbit-settings-field-copy">
                <span className="orbit-settings-field-label">触达时间范围</span>
                <p className="orbit-settings-field-hint">
                  非固定触达会在这个范围内动态发生；超出范围只排程不发送。
                </p>
              </div>
              <div className="orbit-settings-time-pair">
                <label>
                  <span>开始</span>
                  <input
                    type="time"
                    className="orbit-input orbit-settings-compact-input"
                    value={draft.pushStart}
                    onChange={(event) => patchDraft({ pushStart: event.target.value })}
                  />
                </label>
                <label>
                  <span>结束</span>
                  <input
                    type="time"
                    className="orbit-input orbit-settings-compact-input"
                    value={draft.pushEnd}
                    onChange={(event) => patchDraft({ pushEnd: event.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="orbit-settings-field orbit-settings-field--stacked orbit-settings-field--editable">
              <div className="orbit-settings-field-copy">
                <label htmlFor="settings-companion-preferred-time" className="orbit-settings-field-label">
                  偏好时间
                </label>
                <p className="orbit-settings-field-hint">
                  固定型陪伴优先靠近这个时间，非固定型陪伴仍会在触达范围内灵活出现。
                </p>
              </div>
              <div className="orbit-settings-field-control orbit-settings-field-control--block">
                <input
                  id="settings-companion-preferred-time"
                  type="time"
                  className="orbit-input orbit-settings-compact-input"
                  value={draft.preferredTime}
                  onChange={(event) => patchDraft({ preferredTime: event.target.value })}
                />
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="安静时段">
          <div className="orbit-settings-fields">
            <div className="orbit-settings-field orbit-settings-field--stacked orbit-settings-field--editable">
              <div className="orbit-settings-field-copy">
                <span className="orbit-settings-field-label">不打扰时间</span>
                <p className="orbit-settings-field-hint">
                  这段时间内不会主动发送陪伴内容，跨午夜时间段可直接配置。
                </p>
              </div>
              <div className="orbit-settings-time-pair">
                <label>
                  <span>开始</span>
                  <input
                    type="time"
                    className="orbit-input orbit-settings-compact-input"
                    value={draft.quietStart}
                    onChange={(event) => patchDraft({ quietStart: event.target.value })}
                  />
                </label>
                <label>
                  <span>结束</span>
                  <input
                    type="time"
                    className="orbit-input orbit-settings-compact-input"
                    value={draft.quietEnd}
                    onChange={(event) => patchDraft({ quietEnd: event.target.value })}
                  />
                </label>
              </div>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="调度状态">
          <div className="orbit-settings-fields">
            <div className="orbit-settings-field orbit-settings-field--stacked">
              <div className="orbit-settings-field-copy">
                <span className="orbit-settings-field-label">下次检查时间</span>
                <p className="orbit-settings-field-hint">
                  保存后会重新计算；部署后第一次需要调用 bootstrap 才会有排程。
                </p>
              </div>
              <p className="orbit-settings-readonly-value">{nextAlarmText}</p>
            </div>
          </div>
        </SettingsSection>

        <div className="orbit-settings-actions">
          {dirty ? (
            <p className="orbit-settings-actions-hint orbit-muted">有未保存的更改</p>
          ) : null}
          <button
            type="submit"
            className="orbit-btn orbit-btn-primary"
            disabled={saving || !dirty}
          >
            {saving ? "保存中…" : "保存设置"}
          </button>
        </div>
      </form>
    </>
  );
}
