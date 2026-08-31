import { useEffect, useState } from "react";
import {
  fetchNotificationPreferences,
  getApiErrorMessage,
  shouldToastApiError,
  updateNotificationPreferences,
  registerPushSubscription,
  unregisterPushSubscription,
  type NotificationPreferences,
  type NotificationEventKind,
} from "../lib/api";
import { useToast } from "../hooks/useToast";
import { usePwaInstall } from "../hooks/usePwaInstall";
import { Button, Input, Toggle, Field, Section } from "./ui";

const EVENT_LABELS: Record<NotificationEventKind, string> = {
  entry: "新日记 / 时间线 / 留言",
  comment: "新评论 / 边注",
  letter: "新回信",
};

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlB64ToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function useWebPushState() {
  const isSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window;
  const [sub, setSub] = useState<PushSubscription | null | "loading">(() =>
    isSupported ? "loading" : null
  );

  useEffect(() => {
    if (!isSupported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then(setSub)
      .catch(() => setSub(null));
  }, [isSupported]);

  return { sub, setSub };
}

export function NotificationsSettingsPanel() {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const { sub, setSub } = useWebPushState();

  const { isStandalone, canPrompt, isIOS, setGuideOpen, triggerInstall } = usePwaInstall();
  const pushSupported = "PushManager" in window && "serviceWorker" in navigator;
  const showPushSection = pushSupported || isIOS || !isStandalone;

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
    channel: "inApp" | "feishu" | "webPush",
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

  async function handleEnablePush() {
    if (!VAPID_PUBLIC_KEY || pushBusy) return;
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("已拒绝通知权限，请在浏览器设置中手动开启");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
      });
      await registerPushSubscription(subscription);
      setSub(subscription);
      toast.success("手机推送已开启");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "开启推送失败，请重试"));
    } finally {
      setPushBusy(false);
    }
  }

  async function handleDisablePush() {
    if (!sub || sub === "loading" || pushBusy) return;
    setPushBusy(true);
    try {
      await unregisterPushSubscription(sub.endpoint);
      await sub.unsubscribe();
      setSub(null);
      toast.success("手机推送已关闭");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "关闭推送失败，请重试"));
    } finally {
      setPushBusy(false);
    }
  }

  if (loading || !prefs) {
    return <p className="orbit-muted">加载通知偏好…</p>;
  }

  const isSubscribed = sub !== "loading" && sub !== null;

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">通知偏好</h2>
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
                {pushSupported && VAPID_PUBLIC_KEY ? (
                  <Toggle
                    checked={prefs.events[event].webPush}
                    onChange={(checked) => updateChannel(event, "webPush", checked)}
                    label="手机推送"
                  />
                ) : null}
              </div>
            </Field>
          ))}
        </div>
      </Section>

      <Section title="节流">
        <Field
          label="评论合并窗口（分钟）"
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

      {showPushSection ? (
        <Section
          title="手机推送"
        >
          <div style={{ paddingTop: "0.25rem" }}>
            {!isStandalone ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (canPrompt) {
                    void triggerInstall();
                  } else {
                    setGuideOpen(true);
                  }
                }}
              >
                {canPrompt ? "添加到主屏幕" : "查看添加指引"}
              </Button>
            ) : !VAPID_PUBLIC_KEY ? (
              <Button type="button" variant="secondary" size="sm" disabled>
                未配置推送服务
              </Button>
            ) : isSubscribed ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pushBusy}
                loading={pushBusy}
                onClick={() => void handleDisablePush()}
              >
                关闭本设备推送
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pushBusy || sub === "loading"}
                loading={pushBusy || sub === "loading"}
                onClick={() => void handleEnablePush()}
              >
                开启手机推送
              </Button>
            )}
          </div>
        </Section>
      ) : null}

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
