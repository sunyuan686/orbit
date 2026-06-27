import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  authClient,
  DEFAULT_AI_MODELS,
  getApiErrorMessage,
  shouldToastApiError,
  updateAppSettings,
  type AccentPreset,
  type AiProvider,
} from "../lib/api";
import { ACCENT_PRESET_LIST, applyAccentPreset } from "../lib/accent";
import { useAppSettings } from "../lib/appSettingsContext";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import { AiIcon, PaletteIcon, UserIcon } from "../components/OrbitIcons";

const AI_PROVIDER_OPTIONS: {
  id: AiProvider;
  label: string;
  description: string;
}[] = [
  {
    id: "workers-ai",
    label: "Cloudflare Workers AI",
    description: "默认选项，在 Cloudflare 边缘推理，无需 API Key",
  },
  {
    id: "openai",
    label: "OpenAI",
    description: "使用你自己的 OpenAI API Key，数据发往 OpenAI",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "使用你自己的 Anthropic API Key，数据发往 Anthropic",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    description: "使用你自己的 DeepSeek API Key，中文表现优秀，支持工具调用",
  },
];

type SettingsTab = "appearance" | "account" | "ai";

const SETTINGS_TABS: {
  id: SettingsTab;
  label: string;
  icon: (props: { size?: "sm" }) => ReactNode;
}[] = [
  { id: "appearance", label: "外观", icon: (props) => <PaletteIcon {...props} /> },
  { id: "account", label: "账号", icon: (props) => <UserIcon {...props} /> },
  { id: "ai", label: "AI", icon: (props) => <AiIcon {...props} /> },
];

function isSettingsTab(value: string | null): value is SettingsTab {
  return value === "appearance" || value === "account" || value === "ai";
}

function SettingsField({
  label,
  hint,
  children,
  wide,
  stacked,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Label above, control full width — for cards, lists, multi-line inputs */
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="orbit-settings-field orbit-settings-field--stacked">
        <div className="orbit-settings-field-copy">
          <span className="orbit-settings-field-label">{label}</span>
          {hint ? (
            <p className="orbit-settings-field-hint">{hint}</p>
          ) : null}
        </div>
        <div className="orbit-settings-field-control orbit-settings-field-control--block">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="orbit-settings-field">
      <div className="orbit-settings-field-row">
        <div className="orbit-settings-field-copy">
          <span className="orbit-settings-field-label">{label}</span>
          {hint ? (
            <p className="orbit-settings-field-hint">{hint}</p>
          ) : null}
        </div>
        <div
          className={`orbit-settings-field-control${wide ? " orbit-settings-field-control--wide" : ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function SettingsPage() {
  const toast = useToast();
  const { settings, loading, setSettings } = useAppSettings();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : "appearance";

  const [accentPreset, setAccentPreset] = useState<AccentPreset>("stone");
  const [accentDirty, setAccentDirty] = useState(false);
  const [savingAccent, setSavingAccent] = useState(false);

  const [email, setEmail] = useState("");
  const [emailDirty, setEmailDirty] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [aiProvider, setAiProvider] = useState<AiProvider>("workers-ai");
  const [aiModel, setAiModel] = useState("");
  const [showAdvancedModel, setShowAdvancedModel] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    setPageTitle("设置");
  }, []);

  useEffect(() => {
    if (!settings) return;
    setAccentPreset(settings.accentPreset);
    setAccentDirty(false);
    setAiProvider(settings.aiProvider);
    setAiModel(settings.aiModel);
    setShowAdvancedModel(Boolean(settings.aiModel));
    setOpenaiKey("");
    setAnthropicKey("");
    setDeepseekKey("");
  }, [settings]);

  useEffect(() => {
    if (!session?.user?.email) return;
    setEmail(session.user.email);
    setEmailDirty(false);
  }, [session?.user?.email]);

  const effectiveAiModel = useMemo(() => {
    const trimmed = aiModel.trim();
    return trimmed || DEFAULT_AI_MODELS[aiProvider];
  }, [aiModel, aiProvider]);

  const isAiDirty = useMemo(() => {
    if (!settings) return false;
    return (
      aiProvider !== settings.aiProvider ||
      aiModel.trim() !== settings.aiModel ||
      Boolean(openaiKey.trim() || anthropicKey.trim() || deepseekKey.trim())
    );
  }, [settings, aiProvider, aiModel, openaiKey, anthropicKey, deepseekKey]);

  function setTab(tab: SettingsTab) {
    setSearchParams(tab === "appearance" ? {} : { tab }, { replace: true });
  }

  function handleAccentSelect(preset: AccentPreset) {
    setAccentPreset(preset);
    setAccentDirty(preset !== (settings?.accentPreset ?? "stone"));
    applyAccentPreset(preset);
  }

  async function handleSaveAccent() {
    if (savingAccent) return;
    setSavingAccent(true);
    try {
      const next = await updateAppSettings({ accentPreset });
      setSettings(next);
      setAccentDirty(false);
      toast.success("外观已保存");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
      }
      if (settings) applyAccentPreset(settings.accentPreset);
    } finally {
      setSavingAccent(false);
    }
  }

  async function handleSaveAi() {
    if (savingAi) return;

    if (aiProvider === "openai" && !settings?.hasOpenaiKey && !openaiKey.trim()) {
      toast.error("使用 OpenAI 前请先配置 API Key");
      return;
    }
    if (
      aiProvider === "anthropic" &&
      !settings?.hasAnthropicKey &&
      !anthropicKey.trim()
    ) {
      toast.error("使用 Anthropic 前请先配置 API Key");
      return;
    }
    if (
      aiProvider === "deepseek" &&
      !settings?.hasDeepseekKey &&
      !deepseekKey.trim()
    ) {
      toast.error("使用 DeepSeek 前请先配置 API Key");
      return;
    }

    setSavingAi(true);
    try {
      const payload: Parameters<typeof updateAppSettings>[0] = {
        aiProvider,
        aiModel: aiModel.trim() || null,
      };
      if (openaiKey.trim()) payload.openaiKey = openaiKey.trim();
      if (anthropicKey.trim()) payload.anthropicKey = anthropicKey.trim();
      if (deepseekKey.trim()) payload.deepseekKey = deepseekKey.trim();

      const next = await updateAppSettings(payload);
      setSettings(next);
      setOpenaiKey("");
      setAnthropicKey("");
      setDeepseekKey("");
      toast.success("AI 设置已保存");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
      }
    } finally {
      setSavingAi(false);
    }
  }

  async function handleClearOpenaiKey() {
    if (savingAi) return;
    setSavingAi(true);
    try {
      const next = await updateAppSettings({ openaiKey: null });
      setSettings(next);
      setOpenaiKey("");
      toast.success("OpenAI Key 已清除");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "清除失败，请稍后重试"));
      }
    } finally {
      setSavingAi(false);
    }
  }

  async function handleClearAnthropicKey() {
    if (savingAi) return;
    setSavingAi(true);
    try {
      const next = await updateAppSettings({ anthropicKey: null });
      setSettings(next);
      setAnthropicKey("");
      toast.success("Anthropic Key 已清除");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "清除失败，请稍后重试"));
      }
    } finally {
      setSavingAi(false);
    }
  }

  async function handleClearDeepseekKey() {
    if (savingAi) return;
    setSavingAi(true);
    try {
      const next = await updateAppSettings({ deepseekKey: null });
      setSettings(next);
      setDeepseekKey("");
      toast.success("DeepSeek Key 已清除");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "清除失败，请稍后重试"));
      }
    } finally {
      setSavingAi(false);
    }
  }

  async function handleUpdateEmail(event: React.FormEvent) {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail || savingEmail) return;
    if (nextEmail === session?.user?.email) {
      toast.error("邮箱与当前相同");
      return;
    }
    setSavingEmail(true);
    try {
      const { error } = await authClient.changeEmail({
        newEmail: nextEmail,
        callbackURL: "/settings?tab=account",
      });
      if (error) {
        toast.error(error.message || "邮箱更新失败");
        return;
      }
      await refetchSession();
      setEmailDirty(false);
      toast.success("邮箱已更新");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleUpdatePassword(event: React.FormEvent) {
    event.preventDefault();
    if (savingPassword || !currentPassword || !newPassword) return;
    if (newPassword.length < 8) {
      toast.error("新密码至少 8 位");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });
      if (error) {
        toast.error(error.message || "密码更新失败，请检查当前密码");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      toast.success("密码已更新");
    } catch {
      toast.error("网络错误，请稍后重试");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="orbit-settings-content" data-page="settings">
      <header className="orbit-settings-page-header">
        <h1 className="orbit-page-title">设置</h1>
        <p className="orbit-muted orbit-settings-page-desc">
          管理外观、账号与 AI。纪念日在
          {" "}
          <Link to="/space" className="orbit-text-link">
            我们的空间
          </Link>
          {" "}
          管理。
        </p>
      </header>

      <div className="orbit-settings-layout">
        <nav className="orbit-settings-nav" aria-label="设置分类">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`orbit-settings-nav-item${activeTab === tab.id ? " orbit-settings-nav-item--active" : ""}`}
              aria-current={activeTab === tab.id ? "page" : undefined}
              onClick={() => setTab(tab.id)}
            >
              {tab.icon({ size: "sm" })}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="orbit-settings-panel">
          {activeTab === "appearance" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">外观</h2>
                <p className="orbit-settings-panel-desc">
                  调整主题色，影响按钮与强调色，双方共用。
                </p>
              </header>

              <div className="orbit-settings-fields">
                <SettingsField
                  label="主题色"
                  stacked
                >
                  <div className="orbit-accent-swatches" role="radiogroup" aria-label="主题色">
                    {ACCENT_PRESET_LIST.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        role="radio"
                        aria-checked={accentPreset === preset.id}
                        className={`orbit-accent-swatch orbit-accent-swatch--${preset.id}${accentPreset === preset.id ? " orbit-accent-swatch--active" : ""}`}
                        title={preset.label}
                        onClick={() => handleAccentSelect(preset.id)}
                      >
                        <span className="sr-only">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </SettingsField>
              </div>

              <div className="orbit-settings-actions">
                <button
                  type="button"
                  className="orbit-btn orbit-btn-primary"
                  disabled={savingAccent || !accentDirty || loading}
                  onClick={() => void handleSaveAccent()}
                >
                  {savingAccent ? "保存中…" : "保存外观"}
                </button>
              </div>
            </>
          ) : null}

          {activeTab === "account" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">账号</h2>
                <p className="orbit-settings-panel-desc">
                  管理登录邮箱与密码。身份在注册时选定，用于内容署名。
                </p>
              </header>

              <div className="orbit-settings-fields">
                <SettingsField label="身份" hint="注册时选定，用于内容署名。">
                  <p className="orbit-settings-value">{session?.user?.name ?? "—"}</p>
                </SettingsField>

                <div className="orbit-settings-field">
                  <form onSubmit={(e) => void handleUpdateEmail(e)}>
                    <div className="orbit-settings-field-row">
                      <div className="orbit-settings-field-copy">
                        <label htmlFor="settings-email" className="orbit-settings-field-label">
                          邮箱
                        </label>
                      </div>
                      <div className="orbit-settings-field-control orbit-settings-field-control--wide">
                        <div className="orbit-settings-control-actions">
                          <input
                            id="settings-email"
                            type="email"
                            value={email}
                            autoComplete="email"
                            className="orbit-input w-full"
                            onChange={(event) => {
                              setEmail(event.target.value);
                              setEmailDirty(
                                event.target.value.trim() !== (session?.user?.email ?? "")
                              );
                            }}
                          />
                          <button
                            type="submit"
                            className="orbit-btn orbit-btn--stacked"
                            disabled={savingEmail || !emailDirty}
                          >
                            {savingEmail ? "更新中…" : "更新邮箱"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="orbit-settings-field">
                  <form onSubmit={(e) => void handleUpdatePassword(e)}>
                    <div className="orbit-settings-field-row">
                      <div className="orbit-settings-field-copy">
                        <span className="orbit-settings-field-label">密码</span>
                        <p className="orbit-settings-field-hint">新密码至少 8 位。</p>
                      </div>
                      <div className="orbit-settings-field-control orbit-settings-field-control--wide">
                        <div className="orbit-settings-control-actions">
                          <input
                            type="password"
                            value={currentPassword}
                            autoComplete="current-password"
                            placeholder="当前密码"
                            className="orbit-input w-full"
                            onChange={(event) => setCurrentPassword(event.target.value)}
                          />
                          <input
                            type="password"
                            value={newPassword}
                            autoComplete="new-password"
                            placeholder="新密码"
                            className="orbit-input w-full"
                            minLength={8}
                            onChange={(event) => setNewPassword(event.target.value)}
                          />
                          <button
                            type="submit"
                            className="orbit-btn orbit-btn--stacked"
                            disabled={
                              savingPassword || !currentPassword || newPassword.length < 8
                            }
                          >
                            {savingPassword ? "更新中…" : "更新密码"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === "ai" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">AI</h2>
                <p className="orbit-settings-panel-desc">
                  配置站内 AI 助手使用的模型。默认通过 Cloudflare Workers AI 推理；也可接入自己的 OpenAI 或 Anthropic Key。
                </p>
              </header>

              <div className="orbit-settings-fields">
                <SettingsField
                  label="模型提供商"
                  hint="双方共用同一配置。切换后新对话将使用对应模型。"
                  stacked
                >
                  <div className="orbit-settings-provider-list" role="radiogroup" aria-label="模型提供商">
                    {AI_PROVIDER_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={aiProvider === option.id}
                        className={`orbit-settings-provider-option${aiProvider === option.id ? " orbit-settings-provider-option--active" : ""}`}
                        onClick={() => setAiProvider(option.id)}
                      >
                        <span className="orbit-settings-provider-name">{option.label}</span>
                        <span className="orbit-settings-provider-desc">{option.description}</span>
                      </button>
                    ))}
                  </div>
                </SettingsField>

                {(aiProvider === "openai" || settings?.hasOpenaiKey) ? (
                  <SettingsField
                    label="OpenAI API Key"
                    hint="保存后加密存储，不会明文显示。留空并保存不会清除已有 Key。"
                    stacked
                  >
                    <div className="orbit-settings-field-stack">
                      {settings?.hasOpenaiKey ? (
                        <span className="orbit-settings-key-status orbit-settings-key-status--configured">
                          已配置
                        </span>
                      ) : (
                        <span className="orbit-settings-key-status">未配置</span>
                      )}
                      <input
                        type="password"
                        value={openaiKey}
                        autoComplete="off"
                        placeholder={settings?.hasOpenaiKey ? "输入新 Key 以替换" : "sk-..."}
                        className="orbit-input w-full"
                        onChange={(event) => setOpenaiKey(event.target.value)}
                      />
                      {settings?.hasOpenaiKey ? (
                        <button
                          type="button"
                          className="orbit-btn-ghost orbit-btn-sm orbit-btn--stacked"
                          disabled={savingAi}
                          onClick={() => void handleClearOpenaiKey()}
                        >
                          清除 Key
                        </button>
                      ) : null}
                    </div>
                  </SettingsField>
                ) : null}

                {(aiProvider === "anthropic" || settings?.hasAnthropicKey) ? (
                  <SettingsField
                    label="Anthropic API Key"
                    hint="保存后加密存储，不会明文显示。"
                    stacked
                  >
                    <div className="orbit-settings-field-stack">
                      {settings?.hasAnthropicKey ? (
                        <span className="orbit-settings-key-status orbit-settings-key-status--configured">
                          已配置
                        </span>
                      ) : (
                        <span className="orbit-settings-key-status">未配置</span>
                      )}
                      <input
                        type="password"
                        value={anthropicKey}
                        autoComplete="off"
                        placeholder={settings?.hasAnthropicKey ? "输入新 Key 以替换" : "sk-ant-..."}
                        className="orbit-input w-full"
                        onChange={(event) => setAnthropicKey(event.target.value)}
                      />
                      {settings?.hasAnthropicKey ? (
                        <button
                          type="button"
                          className="orbit-btn-ghost orbit-btn-sm orbit-btn--stacked"
                          disabled={savingAi}
                          onClick={() => void handleClearAnthropicKey()}
                        >
                          清除 Key
                        </button>
                      ) : null}
                    </div>
                  </SettingsField>
                ) : null}

                {(aiProvider === "deepseek" || settings?.hasDeepseekKey) ? (
                  <SettingsField
                    label="DeepSeek API Key"
                    hint="保存后加密存储，不会明文显示。可在 platform.deepseek.com 获取。"
                    stacked
                  >
                    <div className="orbit-settings-field-stack">
                      {settings?.hasDeepseekKey ? (
                        <span className="orbit-settings-key-status orbit-settings-key-status--configured">
                          已配置
                        </span>
                      ) : (
                        <span className="orbit-settings-key-status">未配置</span>
                      )}
                      <input
                        type="password"
                        value={deepseekKey}
                        autoComplete="off"
                        placeholder={settings?.hasDeepseekKey ? "输入新 Key 以替换" : "sk-..."}
                        className="orbit-input w-full"
                        onChange={(event) => setDeepseekKey(event.target.value)}
                      />
                      {settings?.hasDeepseekKey ? (
                        <button
                          type="button"
                          className="orbit-btn-ghost orbit-btn-sm orbit-btn--stacked"
                          disabled={savingAi}
                          onClick={() => void handleClearDeepseekKey()}
                        >
                          清除 Key
                        </button>
                      ) : null}
                    </div>
                  </SettingsField>
                ) : null}

                <SettingsField
                  label="模型 ID"
                  hint={
                    <>
                      当前默认：{DEFAULT_AI_MODELS[aiProvider]}
                      {effectiveAiModel !== DEFAULT_AI_MODELS[aiProvider]
                        ? ` · 已自定义为 ${effectiveAiModel}`
                        : ""}
                    </>
                  }
                  stacked
                >
                  <button
                    type="button"
                    className="orbit-btn-ghost orbit-btn-sm"
                    onClick={() => setShowAdvancedModel((value) => !value)}
                  >
                    {showAdvancedModel ? "收起高级设置" : "展开高级设置"}
                  </button>
                  {showAdvancedModel ? (
                    <input
                      type="text"
                      value={aiModel}
                      placeholder={DEFAULT_AI_MODELS[aiProvider]}
                      className="orbit-input w-full orbit-settings-advanced-input"
                      onChange={(event) => setAiModel(event.target.value)}
                    />
                  ) : null}
                </SettingsField>
              </div>

              <div className="orbit-settings-actions">
                <button
                  type="button"
                  className="orbit-btn orbit-btn-primary"
                  disabled={savingAi || !isAiDirty || loading}
                  onClick={() => void handleSaveAi()}
                >
                  {savingAi ? "保存中…" : "保存 AI 设置"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
