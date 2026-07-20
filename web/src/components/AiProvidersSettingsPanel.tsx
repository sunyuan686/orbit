import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_ENABLED_AI_MODELS,
  DEFAULT_ENABLED_AI_PROVIDERS,
  DEFAULT_WORKERS_AI_MODEL,
  discoverAiConnectionModels,
  fetchDeepseekModels,
  fetchWorkersAiModels,
  getApiErrorMessage,
  shouldToastApiError,
  testAiConnection,
  testDeepseekConnection,
  updateAppSettings,
  type AiCustomConnection,
  type AiCustomConnectionPublic,
  type AiProvider,
} from "../lib/api";
import {
  buildUnifiedChatModels,
  formatCustomModelRef,
  formatWorkersAiModelRef,
  groupCatalogForSettings,
  type UnifiedChatModel,
} from "../lib/ai-model-catalog";
import { useAppSettings } from "../lib/appSettingsContext";
import { useToast } from "../lib/useToast";
import { ChevronDownIcon, CloseIcon, SearchIcon } from "./OrbitIcons";

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
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="orbit-settings-field orbit-settings-field--stacked">
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
  return null;
}

interface ConnectionDraft {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  models: Array<{ id: string; label?: string }>;
  enabled: boolean;
  isNew: boolean;
}

function emptyConnectionDraft(): ConnectionDraft {
  return {
    id: crypto.randomUUID(),
    name: "",
    baseUrl: "",
    apiKey: "",
    models: [],
    enabled: true,
    isNew: true,
  };
}

export function AiProvidersSettingsPanel() {
  const toast = useToast();
  const { settings, setSettings } = useAppSettings();

  const [showCustomSuppliers, setShowCustomSuppliers] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [editingDeepseekKey, setEditingDeepseekKey] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testingDeepseek, setTestingDeepseek] = useState(false);
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null);
  const [togglingGroupId, setTogglingGroupId] = useState<string | null>(null);
  const [workersModels, setWorkersModels] = useState<
    Awaited<ReturnType<typeof fetchWorkersAiModels>>["models"]
  >([]);
  const [deepseekModels, setDeepseekModels] = useState<
    Awaited<ReturnType<typeof fetchDeepseekModels>>["models"]
  >([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft | null>(
    null
  );
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(
    null
  );
  const [discoveringConnectionId, setDiscoveringConnectionId] = useState<
    string | null
  >(null);
  const [manualModelId, setManualModelId] = useState("");

  useEffect(() => {
    if ((settings?.aiConnections.length ?? 0) > 0) {
      setShowCustomSuppliers(true);
    }
  }, [settings?.aiConnections.length]);

  useEffect(() => {
    if (settings?.hasDeepseekKey) {
      setDeepseekKey("");
      setEditingDeepseekKey(false);
    }
  }, [settings?.hasDeepseekKey]);

  const isKeyDirty = Boolean(deepseekKey.trim());
  const showDeepseekKeyInput =
    !settings?.hasDeepseekKey || editingDeepseekKey || isKeyDirty;

  const catalog = useMemo(
    () =>
      buildUnifiedChatModels(
        workersModels,
        deepseekModels,
        settings?.aiConnections ?? []
      ),
    [workersModels, deepseekModels, settings?.aiConnections]
  );

  const enabledProviderIds = useMemo(
    () => settings?.aiEnabledProviders ?? [...DEFAULT_ENABLED_AI_PROVIDERS],
    [settings?.aiEnabledProviders]
  );

  const enabledModelIds = useMemo(
    () => settings?.aiEnabledModels ?? [...DEFAULT_ENABLED_AI_MODELS],
    [settings?.aiEnabledModels]
  );

  const modelGroups = useMemo(() => {
    const groups = groupCatalogForSettings(
      catalog,
      settings?.aiConnections ?? [],
      {
        hasDeepseekKey: Boolean(settings?.hasDeepseekKey),
        enabledProviders: enabledProviderIds,
      }
    );
    const query = modelSearch.trim().toLowerCase();
    if (!query) return groups;
    return groups
      .map((group) => ({
        ...group,
        models: group.models.filter(
          (model) =>
            model.label.toLowerCase().includes(query) ||
            model.id.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.models.length > 0);
  }, [catalog, modelSearch, settings?.aiConnections, settings?.hasDeepseekKey, enabledProviderIds]);

  useEffect(() => {
    let cancelled = false;
    setModelsLoading(true);

    void Promise.all([fetchWorkersAiModels(), fetchDeepseekModels()])
      .then(([workers, deepseek]) => {
        if (cancelled) return;
        setWorkersModels(workers.models);
        setDeepseekModels(deepseek.models);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkersModels([
          {
            id: DEFAULT_WORKERS_AI_MODEL,
            label: DEFAULT_WORKERS_AI_MODEL,
            description: "加载目录失败，已回退到默认模型。请刷新页面重试。",
            task: "Text Generation",
            capabilities: ["工具调用", "推理"],
            supportsToolCalling: true,
            recommended: true,
          },
        ]);
        setDeepseekModels([
          {
            id: DEFAULT_DEEPSEEK_MODEL,
            label: DEFAULT_DEEPSEEK_MODEL,
            description: "加载模型列表失败，已回退到默认模型。请刷新页面重试。",
            capabilities: ["工具调用", "推理"],
            supportsToolCalling: true,
            recommended: true,
          },
        ]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [settings?.hasDeepseekKey]);

  async function persistConnections(
    connections: AiCustomConnection[],
    connectionKey?: { id: string; key: string | null }
  ) {
    const next = await updateAppSettings({
      aiConnections: connections,
      ...(connectionKey ? { connectionKey } : {}),
    });
    setSettings(next);
  }

  async function handleToggleModel(model: UnifiedChatModel, enabled: boolean) {
    if (!settings || togglingModelId) return;

    const current = settings.aiEnabledModels;
    let next: string[];

    if (enabled) {
      if (current.includes(model.id)) return;
      next = [...current, model.id];
    } else {
      if (current.length <= 1) {
        toast.error("至少保留一个可用模型");
        return;
      }
      next = current.filter((id) => id !== model.id);
    }

    setTogglingModelId(model.id);
    try {
      const updated = await updateAppSettings({ aiEnabledModels: next });
      setSettings(updated);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更新模型列表失败"));
      }
    } finally {
      setTogglingModelId(null);
    }
  }

  async function handleToggleBuiltinProvider(
    providerId: "workers-ai" | "deepseek",
    enabled: boolean
  ) {
    if (!settings || togglingGroupId) return;

    if (
      providerId === "deepseek" &&
      enabled &&
      !settings.hasDeepseekKey &&
      !deepseekKey.trim()
    ) {
      toast.error("请先在「供应商」中配置 DeepSeek API Key");
      return;
    }

    const current = settings.aiEnabledProviders;
    let next: AiProvider[];

    if (enabled) {
      if (current.includes(providerId)) return;
      next = [...current, providerId];
    } else {
      if (current.length <= 1) {
        toast.error("至少保留一个内置供应商");
        return;
      }
      next = current.filter((id) => id !== providerId);
    }

    setTogglingGroupId(providerId);
    try {
      const updated = await updateAppSettings({ aiEnabledProviders: next });
      setSettings(updated);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更新供应商失败"));
      }
    } finally {
      setTogglingGroupId(null);
    }
  }

  async function handleToggleConnectionGroup(
    connection: AiCustomConnectionPublic,
    enabled: boolean
  ) {
    if (!settings || togglingGroupId) return;
    const next = settings.aiConnections.map((item) =>
      item.id === connection.id ? { ...item, enabled } : item
    );
    setTogglingGroupId(connection.id);
    try {
      await persistConnections(next);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更新供应商失败"));
      }
    } finally {
      setTogglingGroupId(null);
    }
  }

  async function handleTestDeepseek() {
    if (testingDeepseek) return;
    const key = deepseekKey.trim();
    if (!key && !settings?.hasDeepseekKey) {
      toast.error("请先填写 DeepSeek API Key");
      return;
    }

    setTestingDeepseek(true);
    try {
      await testDeepseekConnection(key || undefined);
      toast.success("连接正常");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "连接失败"));
      }
    } finally {
      setTestingDeepseek(false);
    }
  }

  async function handleSaveDeepseekKey() {
    if (savingAi || !deepseekKey.trim()) return;

    setSavingAi(true);
    try {
      const next = await updateAppSettings({ deepseekKey: deepseekKey.trim() });
      setSettings(next);
      setDeepseekKey("");
      toast.success("DeepSeek Key 已保存");
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

  function startCreateConnection() {
    setShowCustomSuppliers(true);
    setConnectionDraft(emptyConnectionDraft());
    setManualModelId("");
  }

  function startEditConnection(connection: AiCustomConnectionPublic) {
    setShowCustomSuppliers(true);
    setConnectionDraft({
      id: connection.id,
      name: connection.name,
      baseUrl: connection.baseUrl,
      apiKey: "",
      models: [...connection.models],
      enabled: connection.enabled,
      isNew: false,
    });
    setManualModelId("");
  }

  async function handleSaveConnectionDraft() {
    if (!settings || !connectionDraft || savingAi) return;
    const name = connectionDraft.name.trim();
    const baseUrl = connectionDraft.baseUrl.trim();
    if (!name || !baseUrl) {
      toast.error("请填写连接名称与 Base URL");
      return;
    }
    if (connectionDraft.isNew && !connectionDraft.apiKey.trim()) {
      toast.error("请填写 API Key");
      return;
    }

    const payload: AiCustomConnection = {
      id: connectionDraft.id,
      name,
      baseUrl,
      models: connectionDraft.models,
      enabled: connectionDraft.enabled,
    };

    const connections = connectionDraft.isNew
      ? [...settings.aiConnections, payload]
      : settings.aiConnections.map((item) =>
          item.id === connectionDraft.id ? payload : item
        );

    setSavingAi(true);
    try {
      await persistConnections(
        connections,
        connectionDraft.apiKey.trim()
          ? { id: connectionDraft.id, key: connectionDraft.apiKey.trim() }
          : undefined
      );
      setConnectionDraft(null);
      toast.success(connectionDraft.isNew ? "供应商已添加" : "供应商已更新");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存供应商失败"));
      }
    } finally {
      setSavingAi(false);
    }
  }

  async function handleDeleteConnection(connectionId: string) {
    if (!settings || savingAi) return;
    const connections = settings.aiConnections.filter(
      (item) => item.id !== connectionId
    );
    const enabledModels = settings.aiEnabledModels.filter(
      (id) => !id.startsWith(`custom:${connectionId}:`)
    );
    const fallbackModels =
      enabledModels.length > 0
        ? enabledModels
        : [formatWorkersAiModelRef(DEFAULT_WORKERS_AI_MODEL)];

    setSavingAi(true);
    try {
      const next = await updateAppSettings({
        aiConnections: connections,
        aiEnabledModels: fallbackModels,
        connectionKey: { id: connectionId, key: null },
      });
      setSettings(next);
      if (connectionDraft?.id === connectionId) setConnectionDraft(null);
      toast.success("供应商已删除");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "删除供应商失败"));
      }
    } finally {
      setSavingAi(false);
    }
  }

  async function handleTestConnectionDraft() {
    if (!connectionDraft || testingConnectionId) return;
    const baseUrl = connectionDraft.baseUrl.trim();
    const apiKey = connectionDraft.apiKey.trim();
    const stored = settings?.aiConnections.find(
      (item) => item.id === connectionDraft.id
    );
    if (!baseUrl) {
      toast.error("请填写 Base URL");
      return;
    }
    if (!apiKey && !stored?.hasApiKey) {
      toast.error("请先填写 API Key");
      return;
    }

    setTestingConnectionId(connectionDraft.id);
    try {
      await testAiConnection({
        baseUrl,
        apiKey: apiKey || undefined,
        connectionId: !apiKey && stored?.hasApiKey ? connectionDraft.id : undefined,
      });
      toast.success("连接正常");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "连接失败"));
      }
    } finally {
      setTestingConnectionId(null);
    }
  }

  async function handleDiscoverConnectionDraft() {
    if (!connectionDraft || discoveringConnectionId) return;
    const baseUrl = connectionDraft.baseUrl.trim();
    const apiKey = connectionDraft.apiKey.trim();
    const stored = settings?.aiConnections.find(
      (item) => item.id === connectionDraft.id
    );
    if (!baseUrl) {
      toast.error("请填写 Base URL");
      return;
    }
    if (!apiKey && !stored?.hasApiKey) {
      toast.error("请先填写 API Key");
      return;
    }

    setDiscoveringConnectionId(connectionDraft.id);
    try {
      const result = await discoverAiConnectionModels({
        baseUrl,
        apiKey: apiKey || undefined,
        connectionId: !apiKey && stored?.hasApiKey ? connectionDraft.id : undefined,
      });
      const existing = new Set(connectionDraft.models.map((model) => model.id));
      const merged = [...connectionDraft.models];
      for (const model of result.models) {
        if (!existing.has(model.id)) merged.push(model);
      }
      setConnectionDraft({ ...connectionDraft, models: merged });
      toast.success(`已发现 ${result.models.length} 个模型`);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "拉取模型失败"));
      }
    } finally {
      setDiscoveringConnectionId(null);
    }
  }

  function handleAddManualModel() {
    if (!connectionDraft) return;
    const modelId = manualModelId.trim();
    if (!modelId) return;
    if (connectionDraft.models.some((model) => model.id === modelId)) {
      toast.error("模型已存在");
      return;
    }
    setConnectionDraft({
      ...connectionDraft,
      models: [...connectionDraft.models, { id: modelId, label: modelId }],
    });
    setManualModelId("");
  }

  async function handleEnableDiscoveredModels(connectionId: string) {
    if (!settings) return;
    const connection = settings.aiConnections.find(
      (item) => item.id === connectionId
    );
    if (!connection) return;
    const refs = connection.models.map((model) =>
      formatCustomModelRef(connectionId, model.id)
    );
    const next = [...new Set([...settings.aiEnabledModels, ...refs])];
    try {
      const updated = await updateAppSettings({ aiEnabledModels: next });
      setSettings(updated);
      toast.success("已启用该供应商下的模型");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "启用模型失败"));
      }
    }
  }

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">Orbit AI</h2>
        <p className="orbit-settings-panel-desc">
          配置供应商凭证，并选择聊天中可用的模型。聊天页只显示模型名称。
        </p>
      </header>

      <SettingsSection title="供应商">
        <div className="orbit-settings-fields orbit-settings-connection-stack">
          <SettingsField
            label="API 来源"
            hint="Workers AI 无需 Key；DeepSeek 与自定义供应商需配置 API Key 后，模型才会出现在下方列表。"
            stacked
          >
            <div className="orbit-settings-supplier-list">
              <article className="orbit-settings-supplier-card">
                <div className="orbit-settings-connection-block-head">
                  <span className="orbit-settings-connection-block-title">
                    Cloudflare Workers AI
                  </span>
                </div>
                <p className="orbit-settings-connection-block-hint">
                  在 Cloudflare 边缘推理，无需 API Key。模型目录由平台自动同步。
                </p>
                <div className="orbit-settings-supplier-credential">
                  <span className="orbit-settings-supplier-credential-label">
                    API Key
                  </span>
                  <div className="orbit-settings-supplier-credential-summary">
                    <span
                      className="orbit-settings-key-dot orbit-settings-key-dot--on"
                      aria-hidden="true"
                    />
                    <span>无需 Key</span>
                  </div>
                </div>
              </article>

              <article className="orbit-settings-supplier-card">
                <div className="orbit-settings-connection-block-head">
                  <span className="orbit-settings-connection-block-title">
                    DeepSeek
                  </span>
                </div>
                <p className="orbit-settings-connection-block-hint">
                  官方 DeepSeek API ·{" "}
                  <a
                    href="https://platform.deepseek.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="orbit-text-link"
                  >
                    platform.deepseek.com
                  </a>
                </p>

                <div className="orbit-settings-supplier-credential">
                  <span className="orbit-settings-supplier-credential-label">
                    API Key
                  </span>
                  {showDeepseekKeyInput ? (
                    <div className="orbit-settings-supplier-credential-edit">
                      <div className="orbit-settings-key-row">
                        <input
                          type="password"
                          value={deepseekKey}
                          autoComplete="off"
                          placeholder={
                            settings?.hasDeepseekKey
                              ? "粘贴新 Key"
                              : "sk-..."
                          }
                          className="orbit-input orbit-settings-key-input"
                          onChange={(event) =>
                            setDeepseekKey(event.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="orbit-btn orbit-btn-sm orbit-settings-key-test"
                          disabled={
                            testingDeepseek ||
                            (!deepseekKey.trim() && !settings?.hasDeepseekKey)
                          }
                          onClick={() => void handleTestDeepseek()}
                        >
                          {testingDeepseek ? "检测中…" : "检测"}
                        </button>
                        {isKeyDirty ? (
                          <button
                            type="button"
                            className="orbit-btn orbit-btn-sm"
                            disabled={savingAi}
                            onClick={() => void handleSaveDeepseekKey()}
                          >
                            {savingAi ? "保存中…" : "保存"}
                          </button>
                        ) : null}
                        {settings?.hasDeepseekKey ? (
                          <button
                            type="button"
                            className="orbit-btn-ghost orbit-btn-sm"
                            disabled={savingAi}
                            onClick={() => {
                              setEditingDeepseekKey(false);
                              setDeepseekKey("");
                            }}
                          >
                            取消
                          </button>
                        ) : null}
                      </div>
                      {!settings?.hasDeepseekKey ? (
                        <p className="orbit-settings-supplier-credential-hint">
                          未配置 · 填写 Key 后点保存
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="orbit-settings-supplier-credential-summary">
                      <span
                        className="orbit-settings-key-dot orbit-settings-key-dot--on"
                        aria-hidden="true"
                      />
                      <span>已配置</span>
                      <div className="orbit-settings-supplier-credential-actions">
                        <button
                          type="button"
                          className="orbit-text-link"
                          onClick={() => setEditingDeepseekKey(true)}
                        >
                          更换
                        </button>
                        <button
                          type="button"
                          className="orbit-text-link"
                          disabled={testingDeepseek}
                          onClick={() => void handleTestDeepseek()}
                        >
                          {testingDeepseek ? "检测中…" : "检测"}
                        </button>
                        <button
                          type="button"
                          className="orbit-text-link orbit-settings-key-clear"
                          disabled={savingAi}
                          onClick={() => void handleClearDeepseekKey()}
                        >
                          清除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            </div>
          </SettingsField>

          <SettingsField
            label="自定义供应商"
            hint="接入 OpenAI 兼容 API（OpenRouter、Ollama、Groq 等）。配置凭证并发现模型后，会作为新供应商出现在下方「模型」分组中。"
            stacked
          >
            <div className="orbit-settings-connections-panel">
              <button
                type="button"
                className="orbit-settings-connections-trigger"
                aria-expanded={showCustomSuppliers}
                onClick={() => setShowCustomSuppliers((value) => !value)}
              >
                <span>OpenAI 兼容供应商</span>
                <ChevronDownIcon
                  size="sm"
                  className={`orbit-settings-connections-chevron${showCustomSuppliers ? " orbit-settings-connections-chevron--open" : ""}`}
                />
              </button>

              {showCustomSuppliers ? (
                <div className="orbit-settings-connections-body">
                  <p className="orbit-settings-connection-block-hint">
                    Base URL 通常以{" "}
                    <code className="orbit-settings-inline-code">/v1</code> 结尾，例如{" "}
                    <code className="orbit-settings-inline-code">
                      https://openrouter.ai/api/v1
                    </code>
                    。
                  </p>

                  {(settings?.aiConnections ?? []).length === 0 && !connectionDraft ? (
                    <p className="orbit-settings-empty-hint orbit-muted">
                      尚未添加自定义供应商
                    </p>
                  ) : null}

                  {(settings?.aiConnections ?? []).map((connection) => (
                  <article
                    key={connection.id}
                    className="orbit-settings-supplier-card orbit-settings-supplier-card--listed"
                  >
                    <div className="orbit-settings-connection-block-head">
                      <span className="orbit-settings-connection-block-title">
                        {connection.name}
                      </span>
                      <div className="orbit-settings-connection-block-actions">
                        <button
                          type="button"
                          className="orbit-btn-ghost orbit-btn-sm"
                          onClick={() => startEditConnection(connection)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="orbit-btn-ghost orbit-btn-sm"
                          disabled={savingAi}
                          onClick={() => void handleDeleteConnection(connection.id)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <p className="orbit-settings-connection-block-meta orbit-muted">
                      {connection.baseUrl}
                    </p>
                    <div className="orbit-settings-supplier-credential orbit-settings-supplier-credential--compact">
                      <span className="orbit-settings-supplier-credential-label">
                        API Key
                      </span>
                      <div className="orbit-settings-supplier-credential-summary">
                        <span
                          className={`orbit-settings-key-dot${connection.hasApiKey ? " orbit-settings-key-dot--on" : ""}`}
                          aria-hidden="true"
                        />
                        <span>{connection.hasApiKey ? "已配置" : "未配置"}</span>
                        <span className="orbit-settings-supplier-credential-meta orbit-muted">
                          {connection.models.length > 0
                            ? `${connection.models.length} 个模型`
                            : "暂无模型"}
                        </span>
                        {connection.models.length > 0 ? (
                          <button
                            type="button"
                            className="orbit-text-link orbit-settings-supplier-credential-action"
                            onClick={() =>
                              void handleEnableDiscoveredModels(connection.id)
                            }
                          >
                            全部启用
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}

                {connectionDraft ? (
                  <article className="orbit-settings-supplier-card orbit-settings-supplier-card--editor">
                    <div className="orbit-settings-connection-form">
                      <label className="orbit-settings-connection-field">
                        <span>供应商名称</span>
                        <input
                          type="text"
                          className="orbit-input orbit-settings-compact-input"
                          placeholder="OpenRouter"
                          value={connectionDraft.name}
                          onChange={(event) =>
                            setConnectionDraft({
                              ...connectionDraft,
                              name: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="orbit-settings-connection-field">
                        <span>Base URL</span>
                        <input
                          type="url"
                          className="orbit-input orbit-settings-compact-input"
                          placeholder="https://openrouter.ai/api/v1"
                          value={connectionDraft.baseUrl}
                          onChange={(event) =>
                            setConnectionDraft({
                              ...connectionDraft,
                              baseUrl: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="orbit-settings-connection-field">
                        <span>API Key</span>
                        <input
                          type="password"
                          className="orbit-input orbit-settings-key-input orbit-settings-key-input--block"
                          autoComplete="off"
                          placeholder={
                            connectionDraft.isNew
                              ? "sk-..."
                              : settings?.aiConnections.find(
                                    (item) => item.id === connectionDraft.id
                                  )?.hasApiKey
                                ? "留空保留现有 Key"
                                : "sk-..."
                          }
                          value={connectionDraft.apiKey}
                          onChange={(event) =>
                            setConnectionDraft({
                              ...connectionDraft,
                              apiKey: event.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="orbit-settings-connection-block-footer">
                      <button
                        type="button"
                        className="orbit-btn orbit-btn-sm orbit-settings-key-test"
                        disabled={testingConnectionId === connectionDraft.id}
                        onClick={() => void handleTestConnectionDraft()}
                      >
                        {testingConnectionId === connectionDraft.id
                          ? "检测中…"
                          : "检测"}
                      </button>
                      <button
                        type="button"
                        className="orbit-btn-ghost orbit-btn-sm"
                        disabled={discoveringConnectionId === connectionDraft.id}
                        onClick={() => void handleDiscoverConnectionDraft()}
                      >
                        {discoveringConnectionId === connectionDraft.id
                          ? "发现中…"
                          : "发现模型"}
                      </button>
                    </div>

                    <div className="orbit-settings-connection-models">
                      <div className="orbit-settings-connection-models-head">
                        <span>供应商模型清单</span>
                        <p className="orbit-settings-field-hint">
                          登记此供应商提供的模型 ID，保存后在下方「模型」区启用。
                        </p>
                        <div className="orbit-settings-connection-add-model">
                          <input
                            type="text"
                            className="orbit-input orbit-settings-compact-input"
                            placeholder="手动添加模型 ID"
                            value={manualModelId}
                            onChange={(event) =>
                              setManualModelId(event.target.value)
                            }
                          />
                          <button
                            type="button"
                            className="orbit-btn-ghost orbit-btn-sm"
                            onClick={handleAddManualModel}
                          >
                            添加
                          </button>
                        </div>
                      </div>
                      {connectionDraft.models.length === 0 ? (
                        <p className="orbit-settings-field-hint">
                          点击「发现模型」或手动添加模型 ID。
                        </p>
                      ) : (
                        <ul className="orbit-settings-connection-model-list">
                          {connectionDraft.models.map((model) => (
                            <li key={model.id}>
                              <span>{model.label || model.id}</span>
                              <button
                                type="button"
                                className="orbit-text-link"
                                onClick={() =>
                                  setConnectionDraft({
                                    ...connectionDraft,
                                    models: connectionDraft.models.filter(
                                      (item) => item.id !== model.id
                                    ),
                                  })
                                }
                              >
                                移除
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="orbit-settings-connection-block-footer">
                      <button
                        type="button"
                        className="orbit-btn-ghost orbit-btn-sm"
                        onClick={() => setConnectionDraft(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="orbit-btn orbit-btn-primary orbit-btn-sm"
                        disabled={savingAi}
                        onClick={() => void handleSaveConnectionDraft()}
                      >
                        {savingAi ? "保存中…" : "保存供应商"}
                      </button>
                    </div>
                  </article>
                ) : (
                  <button
                    type="button"
                    className="orbit-btn orbit-btn-sm"
                    onClick={startCreateConnection}
                  >
                    添加供应商
                  </button>
                )}
              </div>
            ) : null}
            </div>
          </SettingsField>
        </div>
      </SettingsSection>

      <SettingsSection title="模型">
        <div className="orbit-settings-fields">
          <SettingsField
            label="聊天可用模型"
            hint="按供应商分组。组开关控制整个供应商，行开关控制单个模型。"
            stacked
          >
            <div className="orbit-settings-model-catalog">
              <div className="orbit-settings-model-search-wrap">
                <SearchIcon size="sm" className="orbit-settings-model-search-icon" />
                <input
                  type="search"
                  value={modelSearch}
                  placeholder="搜索模型"
                  className="orbit-input orbit-settings-model-search"
                  aria-label="搜索模型"
                  onChange={(event) => setModelSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setModelSearch("");
                  }}
                />
                {modelSearch ? (
                  <button
                    type="button"
                    className="orbit-icon-btn inline-flex orbit-settings-model-search-clear"
                    aria-label="清除搜索"
                    onClick={() => setModelSearch("")}
                  >
                    <CloseIcon size="sm" />
                  </button>
                ) : null}
              </div>

              {modelsLoading ? (
                <p className="orbit-settings-field-hint">加载模型列表…</p>
              ) : modelGroups.length === 0 ? (
                <p className="orbit-settings-field-hint">没有匹配的模型</p>
              ) : (
                <div className="orbit-settings-model-groups">
                  {modelGroups.map((group) => {
                    const groupEnabled = group.enabled;
                    const enabledCount = group.models.filter((model) =>
                      enabledModelIds.includes(model.id)
                    ).length;

                    return (
                      <section
                        key={group.id}
                        className={`orbit-settings-model-group${groupEnabled ? "" : " orbit-settings-model-group--off"}`}
                        aria-label={group.label}
                      >
                        <div className="orbit-settings-model-group-head">
                          <div className="orbit-settings-model-group-copy">
                            <span className="orbit-settings-provider-name">
                              {group.label}
                            </span>
                            <span className="orbit-settings-model-group-meta orbit-muted">
                              {!groupEnabled
                                ? "供应商已关闭"
                                : enabledCount > 0
                                  ? `已开启 ${enabledCount} 个模型`
                                  : "未开启模型"}
                              {group.requiresKey && !group.hasApiKey
                                ? " · 需先在上方配置 Key"
                                : null}
                            </span>
                          </div>
                          {group.canToggle ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={group.enabled}
                              aria-label={`${group.enabled ? "关闭" : "开启"}供应商 ${group.label}`}
                              className={`orbit-toggle${group.enabled ? " orbit-toggle--on" : ""}`}
                              disabled={togglingGroupId === group.id}
                              onClick={() => {
                                if (
                                  group.provider === "workers-ai" ||
                                  group.provider === "deepseek"
                                ) {
                                  void handleToggleBuiltinProvider(
                                    group.provider,
                                    !group.enabled
                                  );
                                  return;
                                }
                                const connection = settings?.aiConnections.find(
                                  (item) => item.id === group.connectionId
                                );
                                if (!connection) return;
                                void handleToggleConnectionGroup(
                                  connection,
                                  !group.enabled
                                );
                              }}
                            >
                              <span className="orbit-toggle-thumb" />
                            </button>
                          ) : null}
                        </div>

                        <ul className="orbit-settings-model-provider-models">
                          {group.models.map((model) => {
                            const enabled = enabledModelIds.includes(model.id);
                            const blocked =
                              !groupEnabled ||
                              (group.requiresKey && !group.hasApiKey);
                            return (
                              <li
                                key={model.id}
                                className="orbit-settings-model-toggle-row"
                              >
                                <span className="orbit-settings-model-toggle-label">
                                  {model.label}
                                  {blocked ? (
                                    <span className="orbit-settings-model-toggle-hint">
                                      {!groupEnabled
                                        ? "供应商已关闭"
                                        : "需配置 Key"}
                                    </span>
                                  ) : null}
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={enabled}
                                  aria-label={`${enabled ? "关闭" : "开启"}模型 ${model.label}`}
                                  className={`orbit-toggle${enabled ? " orbit-toggle--on" : ""}`}
                                  disabled={
                                    togglingModelId === model.id || blocked
                                  }
                                  onClick={() =>
                                    void handleToggleModel(model, !enabled)
                                  }
                                >
                                  <span className="orbit-toggle-thumb" />
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
          </SettingsField>
        </div>
      </SettingsSection>
    </>
  );
}
