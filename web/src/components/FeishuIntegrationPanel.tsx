import { useEffect, useState } from "react";
import {
  fetchFeishuIntegration,
  getApiErrorMessage,
  shouldToastApiError,
  testFeishuIntegration,
  updateFeishuIntegration,
  type FeishuConfigPublic,
} from "../lib/api";
import { useToast } from "../lib/useToast";
import { authClient } from "../lib/api";

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

function SettingsField({
  label,
  hint,
  children,
  stacked,
  readonly,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  stacked?: boolean;
  readonly?: boolean;
}) {
  if (!stacked) return null;
  return (
    <div
      className={`orbit-settings-field orbit-settings-field--stacked${readonly ? " orbit-settings-field--readonly" : ""}`}
    >
      <div className="orbit-settings-field-copy">
        <span className="orbit-settings-field-label">{label}</span>
        {hint ? <p className="orbit-settings-field-hint">{hint}</p> : null}
      </div>
      <div className="orbit-settings-field-control orbit-settings-field-control--block">
        {children}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<FeishuConfigPublic["connectionStatus"], string> = {
  connected: "已连接",
  misconfigured: "未配置完整",
  disabled: "已关闭",
};

export function FeishuIntegrationPanel() {
  const toast = useToast();
  const { data: session } = authClient.useSession();
  const [config, setConfig] = useState<FeishuConfigPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [enabled, setEnabled] = useState(false);
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [encryptKey, setEncryptKey] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [openIdYuan, setOpenIdYuan] = useState("");
  const [openIdLin, setOpenIdLin] = useState("");
  const [homeChatId, setHomeChatId] = useState("");
  const [allowedGroups, setAllowedGroups] = useState("");
  const [mergeWindowMs, setMergeWindowMs] = useState(2000);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchFeishuIntegration();
        if (cancelled) return;
        setConfig(data);
        setEnabled(data.enabled);
        setAppId(data.appId);
        setVerificationToken(data.verificationToken);
        setOpenIdYuan(data.authorOpenIds.小圆子);
        setOpenIdLin(data.authorOpenIds.小麟子);
        setHomeChatId(data.homeChatId);
        setAllowedGroups(data.allowedGroupChatIds.join("\n"));
        setMergeWindowMs(data.mergeWindowMs);
      } catch (err) {
        if (!cancelled && shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载飞书配置失败"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateFeishuIntegration({
        enabled,
        appId,
        verificationToken,
        authorOpenIds: { 小圆子: openIdYuan, 小麟子: openIdLin },
        homeChatId,
        allowedGroupChatIds: allowedGroups
          .split(/[\n,]+/)
          .map((id) => id.trim())
          .filter(Boolean),
        mergeWindowMs,
        ...(appSecret ? { appSecret } : {}),
        ...(encryptKey ? { encryptKey } : {}),
      });
      setConfig(next);
      setAppSecret("");
      setEncryptKey("");
      toast.success("飞书配置已保存");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存失败"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    try {
      await testFeishuIntegration();
      const next = await fetchFeishuIntegration();
      setConfig(next);
      toast.success("测试消息已发送");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "连接测试失败"));
      }
      try {
        const next = await fetchFeishuIntegration();
        setConfig(next);
      } catch {
        // ignore refresh failure
      }
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <p className="orbit-muted">加载飞书配置…</p>;
  }

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">飞书连接</h2>
        <p className="orbit-settings-panel-desc">
          通过飞书 Bot 随手写日记、查今日摘要；凭证加密存储，双方共用一套连接。
        </p>
      </header>

      <SettingsSection title="连接状态">
        <div className="orbit-settings-fields">
          <SettingsField label="状态" hint="保存凭证并测试成功后显示已连接。" readonly stacked>
            <div className="orbit-settings-readonly-card">
              <p className="orbit-settings-readonly-value">
                {config ? STATUS_LABEL[config.connectionStatus] : "—"}
              </p>
              {config?.lastError ? (
                <p className="orbit-settings-field-hint">{config.lastError}</p>
              ) : null}
            </div>
          </SettingsField>
          <SettingsField
            label="Webhook URL"
            hint="复制到飞书开发者后台 → 事件订阅 → 请求地址。"
            readonly
            stacked
          >
            <div className="orbit-settings-inline-form">
              <input
                className="orbit-input orbit-settings-input-block"
                readOnly
                value={config?.webhookUrl ?? ""}
              />
              <button
                type="button"
                className="orbit-btn orbit-btn-sm"
                onClick={() => {
                  if (!config?.webhookUrl) return;
                  void navigator.clipboard.writeText(config.webhookUrl);
                  toast.success("已复制 Webhook URL");
                }}
              >
                复制
              </button>
            </div>
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title="应用凭证">
        <div className="orbit-settings-fields">
          <SettingsField label="启用" hint="关闭后忽略入站消息（仍应验签）。" stacked>
            <label className="orbit-settings-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>启用飞书接入</span>
            </label>
          </SettingsField>
          <SettingsField label="App ID" stacked>
            <input
              className="orbit-input orbit-settings-input-block"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              autoComplete="off"
            />
          </SettingsField>
          <SettingsField
            label="App Secret"
            hint={config?.hasAppSecret ? "已配置；留空则不修改。" : "必填，保存后加密存储。"}
            stacked
          >
            <input
              type="password"
              className="orbit-input orbit-settings-input-block"
              value={appSecret}
              placeholder={config?.hasAppSecret ? "••••••••" : ""}
              onChange={(e) => setAppSecret(e.target.value)}
              autoComplete="new-password"
            />
          </SettingsField>
          <SettingsField
            label="Encrypt Key"
            hint={config?.hasEncryptKey ? "已配置；留空则不修改。" : "推荐配置，用于验签与解密。"}
            stacked
          >
            <input
              type="password"
              className="orbit-input orbit-settings-input-block"
              value={encryptKey}
              placeholder={config?.hasEncryptKey ? "••••••••" : ""}
              onChange={(e) => setEncryptKey(e.target.value)}
              autoComplete="new-password"
            />
          </SettingsField>
          <SettingsField label="Verification Token" hint="可选，纵深校验。" stacked>
            <input
              className="orbit-input orbit-settings-input-block"
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value)}
              autoComplete="off"
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title="身份映射">
        <div className="orbit-settings-fields">
          <SettingsField label="小圆子 open_id" stacked>
            <input
              className="orbit-input orbit-settings-input-block"
              value={openIdYuan}
              onChange={(e) => setOpenIdYuan(e.target.value)}
            />
          </SettingsField>
          <SettingsField label="小麟子 open_id" stacked>
            <input
              className="orbit-input orbit-settings-input-block"
              value={openIdLin}
              onChange={(e) => setOpenIdLin(e.target.value)}
            />
          </SettingsField>
          <SettingsField
            label="Home Chat"
            hint="测试连接与后续通知的默认 chat_id；留空则发到当前操作者映射的单聊。"
            stacked
          >
            <input
              className="orbit-input orbit-settings-input-block"
              value={homeChatId}
              onChange={(e) => setHomeChatId(e.target.value)}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title="高级">
        <div className="orbit-settings-fields">
          <SettingsField
            label="允许群 chat_id"
            hint="每行一个；留空表示仅单聊可写。群聊须 @Bot。"
            stacked
          >
            <textarea
              className="orbit-input orbit-settings-input-block"
              rows={3}
              value={allowedGroups}
              onChange={(e) => setAllowedGroups(e.target.value)}
            />
          </SettingsField>
          <SettingsField label="消息合并窗口（毫秒）" stacked>
            <input
              type="number"
              min={0}
              step={500}
              className="orbit-input orbit-settings-input-block"
              value={mergeWindowMs}
              onChange={(e) => setMergeWindowMs(Number(e.target.value) || 0)}
            />
          </SettingsField>
        </div>
      </SettingsSection>

      <div className="orbit-settings-actions">
        <button
          type="button"
          className="orbit-btn orbit-btn-primary"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "保存中…" : "保存配置"}
        </button>
        <button
          type="button"
          className="orbit-btn"
          disabled={testing || !config?.hasAppSecret}
          onClick={() => void handleTest()}
        >
          {testing ? "测试中…" : "测试连接"}
        </button>
        {session?.user?.name ? (
          <p className="orbit-settings-actions-hint orbit-muted">
            当前登录：{session.user.name}
          </p>
        ) : null}
      </div>
    </>
  );
}
