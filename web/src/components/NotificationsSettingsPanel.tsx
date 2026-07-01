import { useEffect, useState } from "react";
import {
  fetchNotificationPreferences,
  getApiErrorMessage,
  shouldToastApiError,
  updateNotificationPreferences,
  type NotificationPreferences,
  type NotificationEventKind,
} from "../lib/api";
import { useToast } from "../lib/useToast";

const EVENT_LABELS: Record<NotificationEventKind, string> = {
  entry: "新日记 / 时间线 / 留言",
  comment: "新评论 / 边注",
  letter: "新回信",
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

      <SettingsSection title="事件开关">
        <div className="orbit-settings-fields">
          {(Object.keys(EVENT_LABELS) as NotificationEventKind[]).map((event) => (
            <div key={event} className="orbit-settings-field orbit-settings-field--stacked">
              <div className="orbit-settings-field-copy">
                <span className="orbit-settings-field-label">{EVENT_LABELS[event]}</span>
              </div>
              <div className="orbit-settings-field-control orbit-settings-field-control--block">
                <label className="orbit-settings-toggle">
                  <input
                    type="checkbox"
                    checked={prefs.events[event].inApp}
                    onChange={(e) => updateChannel(event, "inApp", e.target.checked)}
                  />
                  <span>站内通知</span>
                </label>
                <label className="orbit-settings-toggle">
                  <input
                    type="checkbox"
                    checked={prefs.events[event].feishu}
                    onChange={(e) => updateChannel(event, "feishu", e.target.checked)}
                  />
                  <span>飞书推送</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="节流">
        <div className="orbit-settings-fields">
          <div className="orbit-settings-field orbit-settings-field--stacked">
            <div className="orbit-settings-field-copy">
              <span className="orbit-settings-field-label">评论合并窗口（分钟）</span>
              <p className="orbit-settings-field-hint">
                同篇文章在窗口内的多条评论合并为一条站内/飞书通知。
              </p>
            </div>
            <div className="orbit-settings-field-control orbit-settings-field-control--block">
              <input
                type="number"
                min={0}
                max={60}
                className="orbit-input orbit-settings-input-block"
                value={prefs.commentMergeMinutes}
                onChange={(e) =>
                  setPrefs({
                    ...prefs,
                    commentMergeMinutes: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
        </div>
      </SettingsSection>

      <div className="orbit-settings-actions">
        <button
          type="button"
          className="orbit-btn orbit-btn-primary"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "保存中…" : "保存偏好"}
        </button>
      </div>
    </>
  );
}
