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
import { useToast } from "../hooks/useToast";
import { Button, Input, Textarea, Toggle, Badge, Card, Field, Section, Stack } from "./ui";

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
    <Field label={label} hint={hint}>
      <div className="orbit-settings-inline-form orbit-settings-inline-form--wide">
        <Input
          mono
          readOnly
          value={value}
          aria-label={label}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!value}
          onClick={onCopy}
        >
          复制地址
        </Button>
      </div>
    </Field>
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
    <Field
      label={
        <span className="inline-flex items-center gap-2">
          <span>{label}</span>
          <span
            className={`orbit-settings-key-dot${
              configured ? " orbit-settings-key-dot--on" : ""
            }`}
            title={configured ? "已配置" : "未配置"}
            aria-hidden="true"
          />
        </span>
      }
      hint={hint}
    >
      <Input
        type="password"
        mono
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
      />
    </Field>
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

      <Section title="连接状态">
        <Card className="orbit-settings-feishu-hero" aria-live="polite">
          <div className="orbit-settings-feishu-hero-head">
            <div className="orbit-settings-feishu-hero-copy">
              <span className="orbit-settings-connection-block-title">飞书 Bot</span>
              <Badge mono variant={status === "connected" ? "active" : "default"}>
                {STATUS_LABEL[status]}
              </Badge>
              {config?.lastConnectedAt ? (
                <p className="orbit-settings-feishu-meta">
                  上次测试 {formatDateTime(config.lastConnectedAt)}
                </p>
              ) : null}
              {config?.lastError ? (
                <p className="orbit-danger-text">{config.lastError}</p>
              ) : null}
            </div>
            <Toggle
              label="启用接入"
              checked={enabled}
              onChange={setEnabled}
            />
          </div>
          <p className="orbit-settings-connection-block-hint">
            关闭后忽略入站消息，出站通知与 Webhook 验签仍可用。保存后生效。
          </p>
          <div className="orbit-settings-actions-row">
            <Button
              variant="secondary"
              size="sm"
              disabled={testing || !config?.hasAppSecret}
              loading={testing}
              onClick={() => void handleTest()}
            >
              测试连接
            </Button>
          </div>
        </Card>
      </Section>

      <Section title="飞书后台配置">
        <Stack gap="md">
          <CopyUrlRow
            label="事件订阅请求地址"
            hint="开放平台「事件配置」→ 请求地址；订阅 im.message.receive_v1。"
            value={config?.webhookUrl ?? ""}
            onCopy={() => copyUrl(config?.webhookUrl, "事件订阅地址")}
          />
          <CopyUrlRow
            label="回调配置请求地址"
            hint="开放平台「回调配置」→ 请求地址；订阅卡片回传交互与链接预览。"
            value={config?.callbackUrl ?? ""}
            onCopy={() => copyUrl(config?.callbackUrl, "回调地址")}
          />

          <div className="orbit-settings-guide-card">
            <h4 className="orbit-settings-guide-title">
              开放平台配置步骤：
            </h4>
            <ol className="orbit-settings-guide-list list-decimal list-inside">
              <li>复制上方地址并在飞书后台保存（challenge 校验通过）</li>
              <li>在「权限管理」中开通 <code className="orbit-settings-guide-code">im:message</code> 等所需权限</li>
              <li>在「版本管理与发布」中创建并发布应用版本</li>
            </ol>
          </div>
        </Stack>
      </Section>

      <Section title="应用凭证">
        <Stack gap="md">
          <Field label="App ID" hint="飞书开放平台应用的唯一标识（以 cli_ 开头）。">
            <Input
              mono
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              autoComplete="off"
              placeholder="cli_..."
            />
          </Field>
          <SecretField
            label="App Secret"
            configured={Boolean(config?.hasAppSecret)}
            hint={config?.hasAppSecret ? "已加密保存；留空则不修改" : "必填，用于换取飞书凭证与调用 API"}
            value={appSecret}
            placeholder={config?.hasAppSecret ? "粘贴新 Secret" : "请输入 App Secret"}
            onChange={setAppSecret}
          />
          <SecretField
            label="Encrypt Key"
            configured={Boolean(config?.hasEncryptKey)}
            hint={config?.hasEncryptKey ? "已配置；留空则不修改" : "推荐配置，用于 Webhook 验签与解密"}
            value={encryptKey}
            placeholder={config?.hasEncryptKey ? "粘贴新 Key" : "请输入 Encrypt Key（选填）"}
            onChange={setEncryptKey}
          />
          <Field
            label="Verification Token"
            hint="飞书事件订阅的验证令牌，用于校验请求来源真实性。"
          >
            <Input
              mono
              value={verificationToken}
              onChange={(e) => setVerificationToken(e.target.value)}
              autoComplete="off"
              placeholder="请输入 Verification Token"
            />
          </Field>
        </Stack>
      </Section>

      <Section title="身份与投递">
        <Stack gap="md">
          {authors.map((author) => (
            <Field
              key={author.id}
              label={`${author.name} open_id`}
              hint="飞书用户 open_id，用于识别日记作者与投递提醒。"
            >
              <Input
                mono
                value={openIds[author.id] ?? ""}
                onChange={(e) =>
                  setOpenIds((prev) => ({ ...prev, [author.id]: e.target.value }))
                }
                autoComplete="off"
                placeholder="ou_..."
              />
            </Field>
          ))}
          <Field
            label="Home Chat ID"
            hint="通知与测试的默认群/单聊 chat_id；留空则发到当前操作者单聊。"
          >
            <Input
              mono
              value={homeChatId}
              onChange={(e) => setHomeChatId(e.target.value)}
              autoComplete="off"
              placeholder="oc_..."
            />
          </Field>
          <Field
            label="AI 响应超时"
            hint="飞书 AI 超过该时间无完整回复时自动结束（秒，范围 30–900）。"
          >
            <Input
              type="number"
              min={30}
              max={900}
              step={30}
              value={aiResponseTimeoutSec}
              onChange={(e) =>
                setAiResponseTimeoutSec(
                  Math.min(900, Math.max(30, Number(e.target.value) || 180))
                )
              }
            />
          </Field>
          <Field
            label="回复方式"
            hint="开启后 Bot 会以话题（Thread）形式在群/单聊中跟帖回复。"
          >
            <div style={{ paddingTop: "0.25rem" }}>
              <Toggle
                label="默认创建话题回复 (Reply in Thread)"
                checked={replyInThread}
                onChange={setReplyInThread}
              />
            </div>
          </Field>
        </Stack>
      </Section>

      <Section title="高级设置">
        <details className="orbit-settings-disclosure">
          <summary className="orbit-settings-disclosure-summary">
            群聊白名单与消息合并窗口
          </summary>
          <div className="orbit-settings-disclosure-body">
            <Stack gap="md">
              <Field
                label="允许的群 chat_id"
                hint="每行一个；留空表示仅单聊可写。群聊中需 @Bot 触发。"
              >
                <Textarea
                  mono
                  rows={3}
                  value={allowedGroups}
                  onChange={(e) => setAllowedGroups(e.target.value)}
                  placeholder="oc_xxx&#10;oc_yyy"
                />
              </Field>
              <Field
                label="消息合并窗口 (毫秒)"
                hint="短时间内连续发送的多条消息自动合并为同一条日记。"
              >
                <Input
                  type="number"
                  min={0}
                  step={500}
                  value={mergeWindowMs}
                  onChange={(e) => setMergeWindowMs(Number(e.target.value) || 0)}
                />
              </Field>
            </Stack>
          </div>
        </details>
      </Section>

      <div className="orbit-settings-actions">
        <div className="orbit-settings-actions-row">
          <Button
            variant="primary"
            disabled={saving}
            loading={saving}
            onClick={() => void handleSave()}
          >
            保存配置
          </Button>
        </div>
        {session?.user?.name ? (
          <p className="orbit-settings-actions-hint orbit-muted">
            当前操作者：{session.user.name}
          </p>
        ) : null}
      </div>
    </>
  );
}
