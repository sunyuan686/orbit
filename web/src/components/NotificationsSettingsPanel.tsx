import { useEffect, useState } from "react";
import {
  fetchNotificationPreferences,
  getApiErrorMessage,
  shouldToastApiError,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationEventKind,
} from "../lib/api";
import { useToast } from "../hooks/useToast";
import { Button, Input, Toggle, Field, Section } from "./ui";

const EVENT_LABELS: Record<NotificationEventKind, string> = {
  entry: "新日记 / 时间线 / 留言",
  comment: "新评论 / 边注",
  letter: "新回信",
};

export function NotificationsSettingsPanel() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchNotificationPreferences();
        if (!cancelled) setPrefs(data);
      } catch (err) {
        if (!cancelled && shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载通知偏好失败"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  function updateChannel(
    event: NotificationEventKind,
    channel: "inApp" | "feishu",
    value: boolean
  ) {
    setPrefs((current) => {
      if (!current) return current;
      return {
        ...current,
        events: {
          ...current.events,
          [event]: {
            ...current.events[event],
            [channel]: value,
          },
        },
      };
    });
  }

  async function handleSave() {
    if (!prefs || saving) return;
    setSaving(true);
    try {
      const next = await updateNotificationPreferences(prefs);
      setPrefs(next);
      toast.success("通知偏好已保存");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存失败"));
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading || !prefs) {
    return <p className="orbit-muted">加载通知偏好…</p>;
  }

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">通知偏好</h2>
        <p className="orbit-settings-panel-desc">
          控制站内铃铛与飞书 Bot 的推送范围；飞书凭证仍在「飞书」连接页配置。
        </p>
      </header>

      <Section title="事件开关">
        <div className="orbit-settings-fields">
          {(Object.keys(EVENT_LABELS) as NotificationEventKind[]).map((event) => (
            <Field key={event} label={EVENT_LABELS[event]}>
              <div className="flex items-center gap-6">
                <Toggle
                  checked={prefs.events[event].inApp}
                  onChange={(checked) => updateChannel(event, "inApp", checked)}
                  label="站内通知"
                />
                <Toggle
                  checked={prefs.events[event].feishu}
                  onChange={(checked) => updateChannel(event, "feishu", checked)}
                  label="飞书推送"
                />
              </div>
            </Field>
          ))}
        </div>
      </Section>

      <Section title="节流">
        <Field
          label="评论合并窗口（分钟）"
          hint="同篇文章在窗口内的多条评论合并为一条站内/飞书通知。"
        >
          <Input
            type="number"
            mono
            min={0}
            max={60}
            value={prefs.commentMergeMinutes}
            onChange={(e) =>
              setPrefs({
                ...prefs,
                commentMergeMinutes: Number(e.target.value) || 0,
              })
            }
          />
        </Field>
      </Section>

      <div className="orbit-settings-actions">
        <Button
          type="button"
          variant="primary"
          disabled={saving}
          loading={saving}
          onClick={() => void handleSave()}
        >
          保存通知偏好
        </Button>
      </div>
    </>
  );
}
