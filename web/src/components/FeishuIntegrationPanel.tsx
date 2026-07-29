import { useEffect, useState } from "react";
import {
  authClient,
  fetchFeishuIntegration,
  fetchSpaceStatus,
  formatDateTime,
  getApiErrorMessage,
  shouldToastApiError,
  testFeishuIntegration,
  updateFeishuIntegration,
  type FeishuConfigPublic,
  type SpaceAuthor,
} from "../lib/api";
import { useToast } from "../lib/useToast";

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
  verified: "已验证（未启用）",
  misconfigured: "未配置完整",
  disabled: "已关闭",
};

function CopyUrlRow({
  label,
  hint,
  value,
  onCopy,
}: {
  label: string;
  hint: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="orbit-settings-feishu-url-item">
      <div className="orbit-settings-field-copy">
        <span className="orbit-settings-feishu-url-label">{label}</span>
        <p className="orbit-settings-field-hint">{hint}</p>
      </div>
      <div className="orbit-settings-inline-form orbit-settings-inline-form--wide">
        <input
          className="orbit-input orbit-settings-input-mono"
          readOnly
          value={value}
          aria-label={label}
        />
        <button
          type="button"
          className="orbit-btn orbit-btn-sm"
          disabled={!value}
          onClick={onCopy}
        >
          复制
        </button>
      </div>
    </div>
  );
}

function SecretField({
  label,
  hint,
  configured,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint: string;
  configured: boolean;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="orbit-settings-supplier-credential orbit-settings-supplier-credential--compact">
      <span className="orbit-settings-supplier-credential-label">{label}</span>
      <div className="orbit-settings-supplier-credential-edit">
        <div className="orbit-settings-key-row">
          <input
            type="password"
            className="orbit-input orbit-settings-key-input"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            autoComplete="new-password"
            aria-describedby={hint ? `${label}-hint` : undefined}
          />
        </div>
        <div className="orbit-settings-supplier-credential-summary">
          <span
            className={`orbit-settings-key-dot${configured ? " orbit-settings-key-dot--on" : ""}`}
            aria-hidden="true"
          />
          <span id={`${label}-hint`} className="orbit-settings-supplier-credential-hint">
            {hint}
          </span>
        </div>
      </div>
    </div>
  );
}

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
  const [openIds, setOpenIds] = useState<Record<string, string>>({});
  const [authors, setAuthors] = useState<SpaceAuthor[]>([]);
  const [homeChatId, setHomeChatId] = useState("");
  const [allowedGroups, setAllowedGroups] = useState("");
  const [mergeWindowMs, setMergeWindowMs] = useState(2000);
  const [replyInThread, setReplyInThread] = useState(false);
  const [aiResponseTimeoutSec, setAiResponseTimeoutSec] = useState(180);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [data, status] = await Promise.all([
          fetchFeishuIntegration(),
          fetchSpaceStatus(),
        ]);
        if (cancelled) return;
        setAuthors(status.authors);
        setConfig(data);
        setEnabled(data.enabled);
        setAppId(data.appId);
        setVerificationToken(data.verificationToken);
        setOpenIds(data.authorOpenIds ?? {});
        setHomeChatId(data.homeChatId);
        setAllowedGroups(data.allowedGroupChatIds.join("\n"));
        setMergeWindowMs(data.mergeWindowMs);
        setReplyInThread(Boolean(data.replyInThread));
        setAiResponseTimeoutSec(Math.round(data.aiResponseTimeoutMs / 1000));
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
        authorOpenIds: openIds,
        homeChatId,
        allowedGroupChatIds: allowedGroups
          .split(/[\n,]+/)
          .map((id) => id.trim())
          .filter(Boolean),
        mergeWindowMs,
        replyInThread,
        aiResponseTimeoutMs: aiResponseTimeoutSec * 1000,
        ...(appSecret ? { appSecret } : {}),
        ...(encryptKey ? { encryptKey } : {}),
      });
      setConfig(next);
      setAppSecret("");
      setEncryptKey("");
      toast.success("飞书连接已保存");
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
      setEnabled(next.enabled);
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

  function copyUrl(value: string | undefined, label: string) {
    if (!value) return;
    void navigator.clipboard.writeText(value);
    toast.success(`已复制${label}`);
  }

  if (loading) {
    return <p className="orbit-muted">加载飞书配置…</p>;
  }

  const status = config?.connectionStatus ?? "disabled";

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">飞书连接</h2>
        <p className="orbit-settings-panel-desc">
          通过飞书 Bot 写日记、查摘要、收通知。凭证加密存储，双方共用一套连接。
        </p>
      </header>

      <SettingsSection title="连接">
        <article className="orbit-settings-feishu-hero" aria-live="polite">
          <div className="orbit-settings-feishu-hero-head">
            <div className="orbit-settings-feishu-hero-copy">
              <span className="orbit-settings-connection-block-title">飞书 Bot</span>
              <span className={`orbit-feishu-status orbit-feishu-status--${status}`}>
                {STATUS_LABEL[status]}
              </span>
              {config?.lastConnectedAt ? (
                <p className="orbit-settings-feishu-meta">
                  上次测试 {formatDateTime(config.lastConnectedAt)}
                </p>
              ) : null}
              {config?.lastError ? (
                <p className="orbit-danger-text">{config.lastError}</p>
              ) : null}
            </div>
            <label className="orbit-settings-toggle">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>启用接入</span>
            </label>
          </div>
          <p className="orbit-settings-connection-block-hint">
            关闭后忽略入站消息，出站通知与 Webhook 验签仍可用。保存后生效。
          </p>
          <div className="orbit-settings-actions-row">
            <button
              type="button"
              className="orbit-btn orbit-btn-sm"
              disabled={testing || !config?.hasAppSecret}
              onClick={() => void handleTest()}
            >
              {testing ? "测试中…" : "测试连接"}
            </button>
          </div>
        </article>
      </SettingsSection>

      <SettingsSection title="飞书后台">
        <p className="orbit-settings-feishu-setup-note">
          将下列地址填入开放平台，加密策略与 Orbit 保持一致，并发布应用版本。
        </p>
        <div className="orbit-settings-feishu-url-list">
          <CopyUrlRow
            label="事件订阅"
            hint="事件配置 → 请求地址；订阅 im.message.receive_v1。"
            value={config?.webhookUrl ?? ""}
            onCopy={() => copyUrl(config?.webhookUrl, "事件订阅地址")}
          />
          <CopyUrlRow
            label="回调配置"
            hint="回调配置 → 请求地址；订阅卡片回传交互、拉取链接预览数据。"
            value={config?.callbackUrl ?? ""}
            onCopy={() => copyUrl(config?.callbackUrl, "回调地址")}
          />
        </div>
        <ol className="orbit-settings-feishu-setup-steps">
          <li>复制地址并在飞书后台保存（challenge 校验通过）</li>
          <li>订阅事件与回调，开通 im:message 等权限</li>
          <li>创建并发布应用版本</li>
        </ol>
      </SettingsSection>

      <SettingsSection title="应用凭证">
        <article className="orbit-settings-supplier-card">
          <div className="orbit-settings-fields">
            <SettingsField label="App ID" stacked>
            <input
              className="orbit-input orbit-settings-input-block"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              autoComplete="off"
              placeholder="cli_..."
            />
          </SettingsField>
          <SecretField
            label="App Secret"
            configured={Boolean(config?.hasAppSecret)}
            hint={config?.hasAppSecret ? "已配置；留空则不修改" : "必填，保存后加密存储"}
            value={appSecret}
            placeholder={config?.hasAppSecret ? "粘贴新 Secret" : ""}
            onChange={setAppSecret}
          />
          <SecretField
            label="Encrypt Key"
            configured={Boolean(config?.hasEncryptKey)}
            hint={config?.hasEncryptKey ? "已配置；留空则不修改" : "推荐配置，用于验签与解密"}
            value={encryptKey}
            placeholder={config?.hasEncryptKey ? "粘贴新 Key" : ""}
            onChange={setEncryptKey}
          />
          <SettingsField
            label="Verification Token"
            hint="与飞书加密策略一致，用于校验请求来源。"
            stacked
          >
            <input
              className="orbit-input orbit-settings-input-block"
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value)}
              autoComplete="off"
            />
          </SettingsField>
          </div>
        </article>
      </SettingsSection>

      <SettingsSection title="身份与投递">
        <div className="orbit-settings-feishu-identity-grid">
          {authors.map((author) => (
            <SettingsField
              key={author.id}
              label={`${author.name} open_id`}
              hint="飞书用户 open_id，用于识别作者。"
              stacked
            >
              <input
                className="orbit-input orbit-settings-input-block"
                value={openIds[author.id] ?? ""}
                onChange={(e) =>
                  setOpenIds((prev) => ({ ...prev, [author.id]: e.target.value }))
                }
                autoComplete="off"
              />
            </SettingsField>
          ))}
          <SettingsField
            label="Home Chat"
            hint="通知与测试的默认群/单聊 chat_id；留空则发到当前操作者单聊。"
            stacked
          >
            <input
              className="orbit-input orbit-settings-input-block"
              value={homeChatId}
              onChange={(e) => setHomeChatId(e.target.value)}
              autoComplete="off"
              placeholder="oc_..."
            />
          </SettingsField>
          <SettingsField
            label="AI 响应超时"
            hint="飞书 AI 超过该时间无完整回复时，自动结束并更新卡片（秒）。范围 30–900 秒，默认 180 秒。"
            stacked
          >
            <input
              type="number"
              min={30}
              max={900}
              step={30}
              className="orbit-input orbit-settings-input-block"
              value={aiResponseTimeoutSec}
              onChange={(e) =>
                setAiResponseTimeoutSec(
                  Math.min(900, Math.max(30, Number(e.target.value) || 180))
                )
              }
            />
          </SettingsField>
          <SettingsField
            label="回复方式"
            hint="开启后回复会显示在独立话题中，不影响 AI 对话记忆（单聊主窗口与话题共用同一 session）。"
            stacked
          >
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", cursor: "pointer", paddingTop: "0.4rem" }}>
              <input
                type="checkbox"
                style={{ width: "1.1rem", height: "1.1rem", cursor: "pointer", accentColor: "var(--orbit-accent, #6366f1)" }}
                checked={replyInThread}
                onChange={(e) => setReplyInThread(e.target.checked)}
              />
              <span style={{ fontSize: "0.9rem", fontWeight: 500 }}>默认创建话题回复 (Reply in Thread)</span>
            </label>
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title="高级">
        <details className="orbit-settings-disclosure">
          <summary className="orbit-settings-disclosure-summary">
            群聊与消息合并
          </summary>
          <div className="orbit-settings-disclosure-body orbit-settings-fields">
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
            <SettingsField
              label="消息合并窗口"
              hint="短时间连发多条时，合并进同一条日记（毫秒）。"
              stacked
            >
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
        </details>
      </SettingsSection>

      <div className="orbit-settings-actions">
        <div className="orbit-settings-actions-row">
          <button
            type="button"
            className="orbit-btn orbit-btn-primary"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "保存中…" : "保存配置"}
          </button>
        </div>
        {session?.user?.name ? (
          <p className="orbit-settings-actions-hint orbit-muted">
            当前登录：{session.user.name}
          </p>
        ) : null}
      </div>
    </>
  );
}
