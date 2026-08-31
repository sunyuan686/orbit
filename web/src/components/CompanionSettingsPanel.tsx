import { useEffect, useMemo, useState } from "react";
import {
  fetchCompanionSettings,
  formatDateTime,
  getApiErrorMessage,
  shouldToastApiError,
  updateCompanionSettings,
  triggerCompanionTestPush,
  type CompanionSettings,
} from "../lib/api";
import { useToast } from "../hooks/useToast";
import { Button, Input, Toggle, Field, Section } from "./ui";

const DEFAULT_SETTINGS: CompanionSettings = {
  enabled: true,
  quietStart: "22:30",
  quietEnd: "08:30",
  pushStart: "09:00",
  pushEnd: "21:30",
  preferredTime: "09:00",
  nextAlarmAt: null,
};

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
  const [testing, setTesting] = useState(false);

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
      </header>

      <form onSubmit={(event) => void handleSave(event)}>
        <Section title="总开关">
          <Field
            label="主动陪伴"
          >
            <Toggle
              checked={draft.enabled}
              onChange={(checked) => patchDraft({ enabled: checked })}
              label={draft.enabled ? "已开启" : "已关闭"}
            />
          </Field>
        </Section>

        <Section title="触达时间">
          <div className="orbit-settings-fields">
            <Field
              label="触达时间范围"
            >
              <div className="orbit-settings-time-pair">
                <label>
                  <span>开始</span>
                  <Input
                    type="time"
                    mono
                    value={draft.pushStart}
                    onChange={(event) => patchDraft({ pushStart: event.target.value })}
                  />
                </label>
                <label>
                  <span>结束</span>
                  <Input
                    type="time"
                    mono
                    value={draft.pushEnd}
                    onChange={(event) => patchDraft({ pushEnd: event.target.value })}
                  />
                </label>
              </div>
            </Field>

            <Field
              label="偏好时间"
              htmlFor="settings-companion-preferred-time"
            >
              <Input
                id="settings-companion-preferred-time"
                type="time"
                mono
                value={draft.preferredTime}
                onChange={(event) => patchDraft({ preferredTime: event.target.value })}
              />
            </Field>
          </div>
        </Section>

        <Section title="安静时段">
          <Field
            label="不打扰时间"
          >
            <div className="orbit-settings-time-pair">
              <label>
                <span>开始</span>
                <Input
                  type="time"
                  mono
                  value={draft.quietStart}
                  onChange={(event) => patchDraft({ quietStart: event.target.value })}
                />
              </label>
              <label>
                <span>结束</span>
                <Input
                  type="time"
                  mono
                  value={draft.quietEnd}
                  onChange={(event) => patchDraft({ quietEnd: event.target.value })}
                />
              </label>
            </div>
          </Field>
        </Section>

        <Section title="调度状态">
          <Field
            label="下次检查时间"
          >
            <p className="orbit-settings-readonly-value">{nextAlarmText}</p>
          </Field>
        </Section>

        <div className="orbit-settings-actions">
          {dirty ? (
            <p className="orbit-settings-actions-hint orbit-muted">有未保存的更改</p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            disabled={testing}
            loading={testing}
            onClick={async () => {
              setTesting(true);
              try {
                await triggerCompanionTestPush();
                toast.success("测试推送已发送！请检查飞书群聊或站内通知。");
              } catch (err) {
                if (shouldToastApiError(err)) {
                  toast.error(getApiErrorMessage(err, "发送测试推送失败"));
                }
              } finally {
                setTesting(false);
              }
            }}
          >
            发送测试推送
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || !dirty}
            loading={saving}
          >
            保存设置
          </Button>
        </div>
      </form>
    </>
  );
}
