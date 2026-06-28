import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  authClient,
  DEFAULT_AI_MODELS,
  fetchWorkersAiModels,
  getApiErrorMessage,
  isAiModelCompatibleWithProvider,
  shouldToastApiError,
  updateAppSettings,
  type AccentPreset,
  type AiProvider,
  type WorkersAiModelOption,
} from "../lib/api";
import { ACCENT_PRESET_LIST, applyAccentPreset } from "../lib/accent";
import { useAppSettings } from "../lib/appSettingsContext";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import { AiIcon, ChevronLeftIcon, ChevronRightIcon, PaletteIcon, TimelineIcon, UserIcon } from "../components/OrbitIcons";
import { SpaceSettingsPanel } from "../components/SpaceSettingsPanel";
import { useMaxWidthMd } from "../lib/useBreakpoint";

const AI_TASK_LABELS: Record<string, string> = {
  "Text Generation": "文本生成",
  "Text Embeddings": "文本嵌入",
  "Text-to-Image": "文生图",
  "Text-to-Speech": "语音合成",
  "Automatic Speech Recognition": "语音识别",
  "Image Classification": "图像分类",
  "Object Detection": "目标检测",
  "Image-to-Text": "图像理解",
  Translation: "翻译",
  Summarization: "摘要",
};

function formatAiTaskLabel(task: string): string {
  return AI_TASK_LABELS[task] ?? task;
}

function formatContextWindow(contextWindow?: number): string | null {
  if (!contextWindow) return null;
  if (contextWindow >= 1_000_000) {
    return `${(contextWindow / 1_000_000).toFixed(1).replace(/\.0$/, "")}M ctx`;
  }
  if (contextWindow >= 1000) {
    return `${Math.round(contextWindow / 1000)}k ctx`;
  }
  return `${contextWindow} ctx`;
}

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
    id: "deepseek",
    label: "DeepSeek",
    description: "使用你自己的 DeepSeek API Key，中文表现优秀，支持工具调用",
  },
];

type SettingsTab = "appearance" | "account" | "ai" | "space";

type SettingsTabConfig = {
  id: SettingsTab;
  label: string;
  description: string;
  icon: (props: { size?: "sm" }) => ReactNode;
};

const SETTINGS_NAV_GROUPS: {
  id: string;
  label: string;
  tabs: SettingsTabConfig[];
}[] = [
  {
    id: "account",
    label: "账户",
    tabs: [
      {
        id: "account",
        label: "登录与安全",
        description: "身份、邮箱与密码",
        icon: (props) => <UserIcon {...props} />,
      },
    ],
  },
  {
    id: "appearance",
    label: "界面",
    tabs: [
      {
        id: "appearance",
        label: "主题",
        description: "强调色与按钮样式",
        icon: (props) => <PaletteIcon {...props} />,
      },
    ],
  },
  {
    id: "space",
    label: "空间",
    tabs: [
      {
        id: "space",
        label: "档案",
        description: "起始日与侧栏展示",
        icon: (props) => <TimelineIcon {...props} />,
      },
    ],
  },
  {
    id: "ai",
    label: "功能",
    tabs: [
      {
        id: "ai",
        label: "Orbit AI",
        description: "模型与 API Key",
        icon: (props) => <AiIcon {...props} />,
      },
    ],
  },
];

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
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

function isSettingsTab(value: string | null): value is SettingsTab {
  return (
    value === "appearance" ||
    value === "account" ||
    value === "ai" ||
    value === "space"
  );
}

function SettingsField({
  label,
  hint,
  children,
  wide,
  stacked,
  readonly,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Label above, control full width — for cards, lists, multi-line inputs */
  stacked?: boolean;
  /** Display-only value without input chrome */
  readonly?: boolean;
}) {
  if (stacked) {
    return (
      <div
        className={`orbit-settings-field orbit-settings-field--stacked${readonly ? " orbit-settings-field--readonly" : ""}`}
      >
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
    <div
      className={`orbit-settings-field${readonly ? " orbit-settings-field--readonly" : ""}`}
    >
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

  const isMobile = useMaxWidthMd();
  const tabParam = searchParams.get("tab");
  const activeTab: SettingsTab = isSettingsTab(tabParam) ? tabParam : "appearance";
  const showMobileMenu = isMobile && !isSettingsTab(tabParam);
  const showMobileDetail = isMobile && isSettingsTab(tabParam);

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
  const [deepseekKey, setDeepseekKey] = useState("");
  const [savingAi, setSavingAi] = useState(false);
  const [workersModels, setWorkersModels] = useState<WorkersAiModelOption[]>([]);
  const [workersModelsLoading, setWorkersModelsLoading] = useState(false);
  const [workersModelsSource, setWorkersModelsSource] = useState<
    "catalog" | "fallback" | null
  >(null);

  useEffect(() => {
    setPageTitle("设置");
  }, []);

  useEffect(() => {
    if (!settings) return;
    setAccentPreset(settings.accentPreset);
    setAccentDirty(false);
    const provider =
      settings.aiProvider === "openai" || settings.aiProvider === "anthropic"
        ? "workers-ai"
        : settings.aiProvider;
    setAiProvider(provider);
    setAiModel(settings.aiModel);
    setShowAdvancedModel(Boolean(settings.aiModel));
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

  const selectedWorkersModel = useMemo(() => {
    return workersModels.find((model) => model.id === effectiveAiModel) ?? null;
  }, [workersModels, effectiveAiModel]);

  const workersModelsByTask = useMemo(() => {
    const groups = new Map<string, WorkersAiModelOption[]>();
    for (const model of workersModels) {
      const list = groups.get(model.task) ?? [];
      list.push(model);
      groups.set(model.task, list);
    }
    return [...groups.entries()].sort(([taskA], [taskB]) => {
      if (taskA === "Text Generation") return -1;
      if (taskB === "Text Generation") return 1;
      return taskA.localeCompare(taskB);
    });
  }, [workersModels]);

  const isAiDirty = useMemo(() => {
    if (!settings) return false;
    return (
      aiProvider !== settings.aiProvider ||
      aiModel.trim() !== settings.aiModel ||
      Boolean(deepseekKey.trim())
    );
  }, [settings, aiProvider, aiModel, deepseekKey]);

  useEffect(() => {
    if (activeTab !== "ai" || aiProvider !== "workers-ai") return;

    let cancelled = false;
    setWorkersModelsLoading(true);

    void fetchWorkersAiModels()
      .then((result) => {
        if (cancelled) return;
        setWorkersModels(result.models);
        setWorkersModelsSource(result.source);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkersModels([
          {
            id: DEFAULT_AI_MODELS["workers-ai"],
            label: "glm-4.7-flash",
            description: "加载目录失败，已回退到默认模型。请刷新页面重试。",
            task: "Text Generation",
            capabilities: ["工具调用", "推理"],
            supportsToolCalling: true,
            recommended: true,
          },
        ]);
        setWorkersModelsSource("fallback");
      })
      .finally(() => {
        if (!cancelled) setWorkersModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, aiProvider]);

  function handleAiProviderChange(nextProvider: AiProvider) {
    setAiProvider(nextProvider);
    const trimmed = aiModel.trim();
    if (!trimmed) return;

    if (!isAiModelCompatibleWithProvider(nextProvider, trimmed)) {
      setAiModel("");
      setShowAdvancedModel(false);
    }
  }

  function handleWorkersModelChange(modelId: string) {
    if (modelId === DEFAULT_AI_MODELS["workers-ai"]) {
      setAiModel("");
    } else {
      setAiModel(modelId);
    }
    setShowAdvancedModel(false);
  }

  function setTab(tab: SettingsTab) {
    setSearchParams({ tab }, { replace: true });
  }

  function backToMobileMenu() {
    setSearchParams({}, { replace: true });
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
      toast.success("主题已更新");
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
      if (deepseekKey.trim()) payload.deepseekKey = deepseekKey.trim();

      const next = await updateAppSettings(payload);
      setSettings(next);
      setDeepseekKey("");
      toast.success("Orbit AI 设置已更新");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
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
    <div
      className="orbit-settings-content"
      data-page="settings"
      data-mobile-view={isMobile ? (showMobileMenu ? "menu" : "detail") : undefined}
    >
      {!(isMobile && showMobileDetail) ? (
        <header className="orbit-settings-page-header">
          <h1 className="orbit-page-title">设置</h1>
          <p className="orbit-muted orbit-settings-page-desc">
            管理账户、界面、空间档案与 Orbit AI。
          </p>
        </header>
      ) : null}

      {showMobileDetail ? (
        <header className="orbit-settings-mobile-toolbar">
          <button
            type="button"
            className="orbit-settings-mobile-back"
            onClick={backToMobileMenu}
          >
            <ChevronLeftIcon size="sm" />
            设置
          </button>
        </header>
      ) : null}

      <div className="orbit-settings-layout">
        {!isMobile ? (
          <nav className="orbit-settings-nav" aria-label="设置分类">
            {SETTINGS_NAV_GROUPS.map((group) => (
              <div key={group.id} className="orbit-settings-nav-group">
                <p className="orbit-settings-nav-group-label">{group.label}</p>
                {group.tabs.map((tab) => (
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
              </div>
            ))}
          </nav>
        ) : null}

        {showMobileMenu ? (
          <nav className="orbit-settings-mobile-menu" aria-label="设置分类">
            {SETTINGS_NAV_GROUPS.map((group) => (
              <div key={group.id} className="orbit-settings-mobile-nav-group">
                <p className="orbit-settings-mobile-group-label">{group.label}</p>
                <ul className="orbit-settings-mobile-group">
                  {group.tabs.map((tab) => {
                    const descId = `settings-tab-desc-${tab.id}`;
                    return (
                      <li key={tab.id}>
                        <button
                          type="button"
                          className="orbit-settings-mobile-row"
                          aria-describedby={descId}
                          onClick={() => setTab(tab.id)}
                        >
                          <span className="orbit-settings-mobile-row-body">
                            <span className="orbit-settings-mobile-row-label">{tab.label}</span>
                            <span id={descId} className="orbit-settings-mobile-row-desc">
                              {tab.description}
                            </span>
                          </span>
                          <ChevronRightIcon size="sm" className="orbit-settings-mobile-row-chevron" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        ) : null}

        {(!isMobile || showMobileDetail) ? (
        <div
          className={`orbit-settings-panel${showMobileDetail ? " orbit-settings-panel--mobile-detail" : ""}`}
          key={showMobileDetail ? activeTab : "desktop"}
        >
          {activeTab === "appearance" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">主题</h2>
                <p className="orbit-settings-panel-desc">
                  调整强调色，影响按钮与重点样式，双方共用。
                </p>
              </header>

              <SettingsSection title="强调色">
                <div className="orbit-settings-fields">
                  <SettingsField label="主题色" stacked>
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
              </SettingsSection>

              <div className="orbit-settings-actions">
                {accentDirty ? (
                  <p className="orbit-settings-actions-hint orbit-muted">有未保存的更改</p>
                ) : null}
                <button
                  type="button"
                  className="orbit-btn orbit-btn-primary"
                  disabled={savingAccent || !accentDirty || loading}
                  onClick={() => void handleSaveAccent()}
                >
                  {savingAccent ? "保存中…" : "保存主题"}
                </button>
              </div>
            </>
          ) : null}

          {activeTab === "account" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">登录与安全</h2>
                <p className="orbit-settings-panel-desc">
                  {isMobile
                    ? "管理登录邮箱与密码。"
                    : "管理登录邮箱与密码。身份在注册时选定，用于内容署名。"}
                </p>
              </header>

              <SettingsSection title="个人资料">
                <div className="orbit-settings-fields">
                  <SettingsField
                    label="身份"
                    hint="注册时选定，不可更改。"
                    readonly
                  >
                    <p className="orbit-settings-readonly-value">{session?.user?.name ?? "—"}</p>
                  </SettingsField>
                </div>
              </SettingsSection>

              <SettingsSection title="登录方式">
                <div className="orbit-settings-fields">
                  <div className="orbit-settings-field orbit-settings-field--editable orbit-settings-field--form">
                    <form
                      className="orbit-settings-form-layout"
                      onSubmit={(e) => void handleUpdateEmail(e)}
                    >
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
                            className="orbit-btn orbit-settings-submit"
                            disabled={savingEmail || !emailDirty}
                          >
                            {savingEmail ? "更新中…" : "更新邮箱"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </SettingsSection>

              <SettingsSection title="密码">
                <div className="orbit-settings-fields">
                  <div className="orbit-settings-field orbit-settings-field--editable orbit-settings-field--form">
                    <form
                      className="orbit-settings-form-layout"
                      onSubmit={(e) => void handleUpdatePassword(e)}
                    >
                      <div className="orbit-settings-field-copy">
                        <label htmlFor="settings-current-password" className="orbit-settings-field-label">
                          密码
                        </label>
                        <p className="orbit-settings-field-hint">新密码至少 8 位。</p>
                      </div>
                      <div className="orbit-settings-field-control orbit-settings-field-control--wide">
                        <div className="orbit-settings-control-actions">
                          <input
                            id="settings-current-password"
                            type="password"
                            value={currentPassword}
                            autoComplete="current-password"
                            placeholder="当前密码"
                            className="orbit-input w-full"
                            onChange={(event) => setCurrentPassword(event.target.value)}
                          />
                          <input
                            id="settings-new-password"
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
                            className="orbit-btn orbit-settings-submit"
                            disabled={
                              savingPassword || !currentPassword || newPassword.length < 8
                            }
                          >
                            {savingPassword ? "更新中…" : "更新密码"}
                          </button>
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              </SettingsSection>
            </>
          ) : null}

          {activeTab === "ai" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">Orbit AI</h2>
                <p className="orbit-settings-panel-desc">
                  配置 Orbit AI 的推理模型。默认通过 Cloudflare Workers AI；也可接入 DeepSeek API Key。
                </p>
              </header>

              <SettingsSection title="模型">
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
                          onClick={() => handleAiProviderChange(option.id)}
                        >
                          <span className="orbit-settings-provider-name">{option.label}</span>
                          <span className="orbit-settings-provider-desc">{option.description}</span>
                        </button>
                      ))}
                    </div>
                  </SettingsField>

                  {aiProvider === "workers-ai" ? (
                    <SettingsField
                      label="Workers AI 模型"
                      hint={
                        workersModelsSource === "fallback"
                          ? "无法连接 Cloudflare 模型目录，已显示精选列表。"
                          : "从 Cloudflare 模型目录加载。Orbit AI 工具调用需要模型支持「工具调用」能力。"
                      }
                      stacked
                    >
                      <div className="orbit-settings-field-stack">
                        {workersModelsLoading ? (
                          <p className="orbit-settings-field-hint">加载模型列表…</p>
                        ) : (
                          <div
                            className="orbit-settings-model-list"
                            role="radiogroup"
                            aria-label="Workers AI 模型"
                          >
                            {!workersModels.some(
                              (model) => model.id === effectiveAiModel
                            ) ? (
                              <button
                                type="button"
                                role="radio"
                                aria-checked
                                className="orbit-settings-model-option orbit-settings-model-option--active"
                                onClick={() => handleWorkersModelChange(effectiveAiModel)}
                              >
                                <div className="orbit-settings-model-option-head">
                                  <span className="orbit-settings-model-name">
                                    {effectiveAiModel}
                                  </span>
                                  <span className="orbit-settings-model-badge orbit-settings-model-badge--custom">
                                    自定义
                                  </span>
                                </div>
                              </button>
                            ) : null}
                            {workersModelsByTask.map(([task, models]) => (
                              <div key={task} className="orbit-settings-model-group">
                                <h3 className="orbit-settings-model-group-label">
                                  {formatAiTaskLabel(task)}
                                </h3>
                                <div className="orbit-settings-model-group-list">
                                  {models.map((model) => {
                                    const isActive = effectiveAiModel === model.id;
                                    const contextLabel = formatContextWindow(
                                      model.contextWindow
                                    );
                                    return (
                                      <button
                                        key={model.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={isActive}
                                        className={`orbit-settings-model-option${isActive ? " orbit-settings-model-option--active" : ""}`}
                                        onClick={() => handleWorkersModelChange(model.id)}
                                      >
                                        <div className="orbit-settings-model-option-head">
                                          <span className="orbit-settings-model-name">
                                            {model.recommended ? (
                                              <span
                                                className="orbit-settings-model-star"
                                                aria-hidden
                                              >
                                                ★{" "}
                                              </span>
                                            ) : null}
                                            {model.label}
                                          </span>
                                          {contextLabel ? (
                                            <span className="orbit-settings-model-ctx">
                                              {contextLabel}
                                            </span>
                                          ) : null}
                                        </div>
                                        {model.capabilities.length > 0 ? (
                                          <div className="orbit-settings-model-caps">
                                            {model.capabilities.map((cap) => (
                                              <span
                                                key={cap}
                                                className="orbit-settings-model-cap"
                                              >
                                                {cap}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {selectedWorkersModel ? (
                          <p className="orbit-settings-field-hint orbit-settings-model-desc">
                            {selectedWorkersModel.description}
                          </p>
                        ) : null}
                        {selectedWorkersModel &&
                        !selectedWorkersModel.supportsToolCalling ? (
                          <p className="orbit-settings-model-warning">
                            此模型不支持工具调用，Orbit AI 的搜索日记等功能可能不可用。
                          </p>
                        ) : null}
                      </div>
                    </SettingsField>
                  ) : null}
                </div>
              </SettingsSection>

              {(aiProvider === "deepseek" || settings?.hasDeepseekKey) ? (
                <SettingsSection title="API Key">
                  <div className="orbit-settings-fields">
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
                  </div>
                </SettingsSection>
              ) : null}

              <SettingsSection title="高级">
                <div className="orbit-settings-fields">
                <SettingsField
                  label={aiProvider === "workers-ai" ? "自定义模型 ID" : "模型 ID"}
                  hint={
                    aiProvider === "workers-ai" ? (
                      <>
                        通常使用上方下拉即可。仅在目录未收录时手动填写完整 ID（如
                        @cf/author/model-name）。
                      </>
                    ) : (
                      <>
                        当前默认：{DEFAULT_AI_MODELS[aiProvider]}
                        {effectiveAiModel !== DEFAULT_AI_MODELS[aiProvider]
                          ? ` · 已自定义为 ${effectiveAiModel}`
                          : ""}
                      </>
                    )
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
              </SettingsSection>

              <div className="orbit-settings-actions">
                <button
                  type="button"
                  className="orbit-btn orbit-btn-primary"
                  disabled={savingAi || !isAiDirty || loading}
                  onClick={() => void handleSaveAi()}
                >
                  {savingAi ? "保存中…" : "保存设置"}
                </button>
              </div>
            </>
          ) : null}

          {activeTab === "space" ? <SpaceSettingsPanel /> : null}
        </div>
        ) : null}
      </div>
    </div>
  );
}
