import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_AI_BOT_NAME,
  DEFAULT_AI_BOT_PERSONA,
  DEFAULT_ENABLED_AI_MODELS,
  DEFAULT_ENABLED_AI_PROVIDERS,
  DEFAULT_WORKERS_AI_MODEL,
  discoverAiConnectionModels,
  getApiErrorMessage,
  shouldToastApiError,
  testAiConnection,
  testAlibabaConnection,
  testDeepseekConnection,
  updateAppSettings,
  type AiCustomConnection,
  type AiCustomConnectionPublic,
  type AiProvider,
  type VoiceTranscribeMode,
} from "../lib/api";
import {
  buildUnifiedChatModels,
  formatAlibabaModelRef,
  formatCustomModelRef,
  formatDeepseekModelRef,
  formatWorkersAiModelRef,
  groupCatalogForSettings,
  type ProviderModelGroup,
  type UnifiedChatModel,
} from "../lib/ai-model-catalog";
import {
  mergeModelSpec,
  resolveSpecKey,
  type ModelSpec,
} from "../lib/ai-model-specs";
import { useAppSettings } from "../lib/appSettingsContext";
import { useToast } from "../lib/useToast";
import { safeRandomUUID } from "../lib/uuid";
import { ChevronDownIcon, CloseIcon, EyeIcon, SearchIcon, SparklesIcon, WrenchIcon } from "./OrbitIcons";

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="orbit-settings-section">
      <h3 className="orbit-settings-section-title">{title}</h3>
      {children}
    </section>
  );
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

function SettingsField({
  label,
  hint,
  children,
  stacked = false,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <div
      className={`orbit-settings-field ${
        stacked ? "orbit-settings-field--stacked" : ""
      }`}
    >
      <div className="orbit-settings-field-copy">
        <label className="orbit-settings-field-label">{label}</label>
        {hint && <p className="orbit-settings-field-hint">{hint}</p>}
      </div>
      <div className="orbit-settings-field-control">{children}</div>
    </div>
  );
}

interface ConnectionDraft {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  hasStoredApiKey?: boolean;
  models: Array<{ id: string; label?: string }>;
  enabled: boolean;
  isNew: boolean;
}

function emptyConnectionDraft(): ConnectionDraft {
  return {
    id: safeRandomUUID(),
    name: "",
    baseUrl: "",
    apiKey: "",
    hasStoredApiKey: false,
    models: [],
    enabled: true,
    isNew: true,
  };
}

export function AiProvidersSettingsPanel() {
  const toast = useToast();
  const { settings, setSettings } = useAppSettings();

  const [selectedVoiceMode, setSelectedVoiceMode] = useState<VoiceTranscribeMode>(
    settings?.voiceTranscribeMode ?? "smooth"
  );

  const [botName, setBotName] = useState("");
  const [botPersona, setBotPersona] = useState("");
  const [savingBotInfo, setSavingBotInfo] = useState(false);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Record<string, boolean>>({});

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroupIds((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  useEffect(() => {
    if (settings?.voiceTranscribeMode) {
      setSelectedVoiceMode(settings.voiceTranscribeMode);
    }
  }, [settings?.voiceTranscribeMode]);

  useEffect(() => {
    if (!settings) return;
    setBotName(settings.aiBotName || DEFAULT_AI_BOT_NAME);
    setBotPersona(settings.aiBotPersona || DEFAULT_AI_BOT_PERSONA);
  }, [settings?.aiBotName, settings?.aiBotPersona]);

  const handleSaveBotInfo = async () => {
    setSavingBotInfo(true);
    try {
      const updated = await updateAppSettings({
        aiBotName: botName.trim(),
        aiBotPersona: botPersona.trim(),
      });
      setSettings(updated);
      toast.success("助手人设设置已更新");
    } catch (err: any) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更新助手设置失败"));
      }
    } finally {
      setSavingBotInfo(false);
    }
  };

  const [showCustomSuppliers, setShowCustomSuppliers] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [deepseekKey, setDeepseekKey] = useState("");
  const [editingDeepseekKey, setEditingDeepseekKey] = useState(false);
  const [alibabaKey, setAlibabaKey] = useState("");
  const [editingAlibabaKey, setEditingAlibabaKey] = useState(false);
  const [savingAi, setSavingAi] = useState(false);
  const [testingDeepseek, setTestingDeepseek] = useState(false);
  const [testingAlibaba, setTestingAlibaba] = useState(false);
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null);
  const [togglingGroupId, setTogglingGroupId] = useState<string | null>(null);
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
  const [editingSpecKey, setEditingSpecKey] = useState<string | null>(null);
  const [specDraft, setSpecDraft] = useState<ModelSpec | null>(null);
  const [savingSpec, setSavingSpec] = useState(false);
  const [savingCustomModel, setSavingCustomModel] = useState(false);

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

  useEffect(() => {
    if (settings?.hasAlibabaKey) {
      setAlibabaKey("");
      setEditingAlibabaKey(false);
    }
  }, [settings?.hasAlibabaKey]);

  const isKeyDirty = Boolean(deepseekKey.trim());
  const showDeepseekKeyInput =
    !settings?.hasDeepseekKey || editingDeepseekKey || isKeyDirty;

  const isAlibabaKeyDirty = Boolean(alibabaKey.trim());
  const showAlibabaKeyInput =
    !settings?.hasAlibabaKey || editingAlibabaKey || isAlibabaKeyDirty;

  const catalog = useMemo(
    () =>
      buildUnifiedChatModels(
        settings?.aiBuiltinCatalog,
        settings?.aiConnections ?? [],
        settings?.aiModelSpecs ?? {}
      ),
    [settings?.aiBuiltinCatalog, settings?.aiConnections, settings?.aiModelSpecs]
  );

  const enabledProviderIds = useMemo(
    () =>
      settings?.aiEnabledProviders ?? [
        ...DEFAULT_ENABLED_AI_PROVIDERS,
      ],
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
        hasAlibabaKey: Boolean(settings?.hasAlibabaKey),
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
  }, [
    catalog,
    modelSearch,
    settings?.aiConnections,
    settings?.hasDeepseekKey,
    settings?.hasAlibabaKey,
    enabledProviderIds,
  ]);

  /** 每个模型的合并后规格（服务端下发的内置默认 + 用户覆盖）。 */
  const modelSpecs = useMemo(() => {
    const map = new Map<string, ModelSpec>();
    for (const group of modelGroups) {
      for (const model of group.models) {
        const resolved = resolveSpecKey(model.id);
        if (!resolved) continue;
        const merged = mergeModelSpec(
          settings?.aiBuiltinModelSpecs?.[resolved.provider]?.[resolved.key],
          settings?.aiModelSpecs?.[resolved.provider]?.[resolved.key]
        );
        map.set(model.id, merged);
      }
    }
    return map;
  }, [modelGroups, settings?.aiModelSpecs, settings?.aiBuiltinModelSpecs]);

  function openSpecEditor(modelId: string) {
    const resolved = resolveSpecKey(modelId);
    if (!resolved) return;
    setEditingSpecKey(modelId);
    setSpecDraft(
      structuredClone(
        modelSpecs.get(modelId) ??
          mergeModelSpec(
            settings?.aiBuiltinModelSpecs?.[resolved.provider]?.[resolved.key],
            undefined
          )
      )
    );
  }

  function closeSpecEditor() {
    setEditingSpecKey(null);
    setSpecDraft(null);
  }

  async function handleSaveModelSpec(modelId: string) {
    if (!settings || !specDraft || savingSpec) return;
    const resolved = resolveSpecKey(modelId);
    if (!resolved) return;
    if (
      !Number.isFinite(specDraft.contextWindow) ||
      specDraft.contextWindow <= 0 ||
      !Number.isFinite(specDraft.maxOutputTokens) ||
      specDraft.maxOutputTokens <= 0
    ) {
      toast.error("上下文窗口与输出上限必须是正整数");
      return;
    }

    const next: Record<string, Record<string, ModelSpec>> = structuredClone(
      settings.aiModelSpecs ?? {}
    );
    next[resolved.provider] ??= {};
    next[resolved.provider][resolved.key] = {
      ...specDraft,
      contextWindow: Math.floor(specDraft.contextWindow),
      maxOutputTokens: Math.floor(specDraft.maxOutputTokens),
      ...(specDraft.reasoning && specDraft.defaultReasoning
        ? { defaultReasoning: specDraft.defaultReasoning }
        : {}),
    };

    setSavingSpec(true);
    try {
      const updated = await updateAppSettings({ aiModelSpecs: next });
      setSettings(updated);
      closeSpecEditor();
      toast.success("模型规格已保存");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存模型规格失败"));
      }
    } finally {
      setSavingSpec(false);
    }
  }

  async function handleDeleteCustomModel(model: UnifiedChatModel) {
    if (!settings) return;
    if (!window.confirm(`确定要移除自定义模型 ${model.label} 吗？`)) return;

    const resolved = resolveSpecKey(model.id);
    if (!resolved) return;

    const nextSpecs = structuredClone(settings.aiModelSpecs ?? {});
    if (nextSpecs[resolved.provider]) {
      delete nextSpecs[resolved.provider][resolved.key];
      if (Object.keys(nextSpecs[resolved.provider]).length === 0) {
        delete nextSpecs[resolved.provider];
      }
    }

    const nextEnabled = (settings.aiEnabledModels ?? []).filter(
      (ref) => ref !== model.id
    );

    try {
      const updated = await updateAppSettings({
        aiModelSpecs: nextSpecs,
        aiEnabledModels: nextEnabled,
      });
      setSettings(updated);
      toast.success(`已移除模型 ${model.label}`);
      if (editingSpecKey === model.id) {
        closeSpecEditor();
      }
    } catch (err: any) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "移除模型失败"));
      }
    }
  }

  const [addModelModalGroup, setAddModelModalGroup] = useState<ProviderModelGroup | null>(null);
  const [newModelDraft, setNewModelDraft] = useState<{
    id: string;
    label: string;
    contextWindow: number;
    reasoning: boolean;
    supportsToolCalling: boolean;
    supportsVision: boolean;
    supportsFileInput: boolean;
    supportsImageOutput: boolean;
    supportsVideoOutput: boolean;
    supportsWebSearch: boolean;
  }>({
    id: "",
    label: "",
    contextWindow: 128_000,
    reasoning: false,
    supportsToolCalling: true,
    supportsVision: false,
    supportsFileInput: true,
    supportsImageOutput: false,
    supportsVideoOutput: false,
    supportsWebSearch: false,
  });

  async function handleCreateCustomModelWithSpecs() {
    if (!settings || !addModelModalGroup || !newModelDraft.id.trim() || savingCustomModel) return;

    const rawId = newModelDraft.id.trim();
    let ref = rawId;
    if (addModelModalGroup.id === "workers-ai") ref = formatWorkersAiModelRef(rawId);
    else if (addModelModalGroup.id === "deepseek") ref = formatDeepseekModelRef(rawId);
    else if (addModelModalGroup.id === "alibaba") ref = formatAlibabaModelRef(rawId);

    const resolved = resolveSpecKey(ref);
    if (!resolved) return;

    const nextSpecs = structuredClone(settings.aiModelSpecs ?? {});
    nextSpecs[resolved.provider] ??= {};
    nextSpecs[resolved.provider][resolved.key] = {
      name: newModelDraft.label.trim() || rawId,
      contextWindow: newModelDraft.contextWindow || 128_000,
      maxOutputTokens: 4_096,
      reasoning: newModelDraft.reasoning,
      supportsToolCalling: newModelDraft.supportsToolCalling,
      supportsVision: newModelDraft.supportsVision,
      supportsFileInput: newModelDraft.supportsFileInput,
      supportsImageOutput: newModelDraft.supportsImageOutput,
      supportsVideoOutput: newModelDraft.supportsVideoOutput,
      supportsWebSearch: newModelDraft.supportsWebSearch,
    };

    const nextEnabled = Array.from(
      new Set([...(settings.aiEnabledModels ?? []), ref])
    );

    setSavingCustomModel(true);
    try {
      const updated = await updateAppSettings({
        aiModelSpecs: nextSpecs,
        aiEnabledModels: nextEnabled,
      });
      setSettings(updated);
      setAddModelModalGroup(null);
      toast.success(`成功添加并启用自定义模型 ${newModelDraft.label.trim() || rawId}`);
    } catch (err: any) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "添加自定义模型失败"));
      }
    } finally {
      setSavingCustomModel(false);
    }
  }

  async function handleResetModelSpec(modelId: string) {
    if (!settings || savingSpec) return;
    const resolved = resolveSpecKey(modelId);
    if (!resolved) return;
    const next: Record<string, Record<string, ModelSpec>> = structuredClone(
      settings.aiModelSpecs ?? {}
    );
    delete next[resolved.provider]?.[resolved.key];
    setSavingSpec(true);
    try {
      const updated = await updateAppSettings({ aiModelSpecs: next });
      setSettings(updated);
      closeSpecEditor();
      toast.success("已重置为内置默认");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "重置模型规格失败"));
      }
    } finally {
      setSavingSpec(false);
    }
  }

  useEffect(() => {
    setModelsLoading(false);
  }, []);

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
    providerId: "workers-ai" | "deepseek" | "alibaba",
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

    if (
      providerId === "alibaba" &&
      enabled &&
      !settings.hasAlibabaKey &&
      !alibabaKey.trim()
    ) {
      toast.error("请先在上方「供应商」中配置并保存 阿里百炼 API Key");
      return;
    }

    const currentProviders = settings.aiEnabledProviders;
    let nextProviders: AiProvider[];

    if (enabled) {
      if (!currentProviders.includes(providerId)) {
        nextProviders = [...currentProviders, providerId];
      } else {
        nextProviders = currentProviders;
      }
    } else {
      if (currentProviders.length <= 1) {
        toast.error("至少保留一个内置供应商");
        return;
      }
      nextProviders = currentProviders.filter((id) => id !== providerId);
    }

    let nextModels = settings.aiEnabledModels;
    if (enabled && providerId === "alibaba") {
      const hasAlibabaModels = nextModels.some((id) => id.startsWith("alibaba:"));
      if (!hasAlibabaModels) {
        nextModels = [
          ...nextModels,
          "alibaba:qwen3.7-plus",
          "alibaba:qwen3.8-max",
        ];
      }
    }

    setTogglingGroupId(providerId);
    try {
      const updated = await updateAppSettings({
        aiEnabledProviders: nextProviders,
        aiEnabledModels: nextModels,
      });
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

  async function handleTestAlibaba() {
    if (testingAlibaba) return;
    const key = alibabaKey.trim();
    if (!key && !settings?.hasAlibabaKey) {
      toast.error("请先填写 阿里百炼 API Key");
      return;
    }

    setTestingAlibaba(true);
    try {
      await testAlibabaConnection(key || undefined);
      toast.success("连接正常");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "连接失败"));
      }
    } finally {
      setTestingAlibaba(false);
    }
  }

  async function handleSaveAlibabaKey() {
    if (savingAi || !alibabaKey.trim() || !settings) return;

    setSavingAi(true);
    try {
      const currentProviders = (settings.aiEnabledProviders ?? []) as AiProvider[];
      const nextProviders: AiProvider[] = currentProviders.includes("alibaba")
        ? currentProviders
        : [...currentProviders, "alibaba"];

      const currentModels = settings.aiEnabledModels ?? [];
      const hasAlibabaModel = currentModels.some((id) => id.startsWith("alibaba:"));
      const nextModels = hasAlibabaModel
        ? currentModels
        : [...currentModels, "alibaba:qwen3.7-plus", "alibaba:qwen3.8-max"];

      const next = await updateAppSettings({
        alibabaKey: alibabaKey.trim(),
        aiEnabledProviders: nextProviders,
        aiEnabledModels: nextModels,
      });
      setSettings(next);
      setAlibabaKey("");
      toast.success("阿里百炼 Key 已保存，通义千问模型已自动启用开启！");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
      }
    } finally {
      setSavingAi(false);
    }
  }

  async function handleClearAlibabaKey() {
    if (savingAi) return;
    setSavingAi(true);
    try {
      const next = await updateAppSettings({ alibabaKey: null });
      setSettings(next);
      setAlibabaKey("");
      toast.success("阿里百炼 Key 已清除");
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
          配置 AI 助手昵称、语气人设与供应商凭证。
        </p>
      </header>

      <SettingsSection title="助手人设与名称">
        <div className="orbit-settings-fields">
          <div className="orbit-settings-field orbit-settings-field--stacked orbit-settings-field--editable">
            <div className="orbit-settings-field-copy">
              <label htmlFor="settings-ai-bot-name" className="orbit-settings-field-label">
                AI 助手名字
              </label>
              <p className="orbit-settings-field-hint">
                设置 AI 在对话与提示词中的专属称呼（例如：“小辛星”、“星宝”、“月老”）。
              </p>
            </div>
            <div className="orbit-settings-field-control orbit-settings-field-control--block">
              <input
                id="settings-ai-bot-name"
                type="text"
                className="orbit-input orbit-settings-bot-name-input"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="小辛星"
              />
            </div>
          </div>

          <div className="orbit-settings-field orbit-settings-field--stacked orbit-settings-field--editable">
            <div className="orbit-settings-field-copy">
              <label htmlFor="settings-ai-bot-persona" className="orbit-settings-field-label">
                AI 语气与人设
              </label>
              <p className="orbit-settings-field-hint">
                自定义 AI 助手的说话风格、语气与定位（留空或重置将使用默认温暖细腻人设）。
              </p>
            </div>
            <div className="orbit-settings-field-control orbit-settings-field-control--block">
              <textarea
                id="settings-ai-bot-persona"
                className="orbit-input orbit-settings-bot-persona-textarea"
                rows={4}
                value={botPersona}
                onChange={(e) => setBotPersona(e.target.value)}
                placeholder="你的性格温暖、真诚、细腻且富有亲和力。你的任务是陪空间内的成员聊天、帮他们回忆温馨时刻、解答日常疑问或提供生活建议。"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", paddingTop: "0.5rem" }}>
            <button
              type="button"
              className="orbit-btn orbit-btn--primary orbit-btn--sm"
              disabled={savingBotInfo}
              onClick={handleSaveBotInfo}
            >
              {savingBotInfo ? "保存中…" : "保存人设修改"}
            </button>
            <button
              type="button"
              className="orbit-btn orbit-btn--ghost orbit-btn--sm"
              disabled={savingBotInfo}
              onClick={() => {
                setBotName(DEFAULT_AI_BOT_NAME);
                setBotPersona(DEFAULT_AI_BOT_PERSONA);
              }}
            >
              重置为默认
            </button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="语音打字设置">
        <div className="orbit-settings-fields">
          <div className="orbit-settings-field orbit-settings-field--stacked">
            <div className="orbit-settings-field-copy">
              <label className="orbit-settings-field-label">
                默认转写与润色模式
              </label>
              <p className="orbit-settings-field-hint">
                设置全局默认的语音打字处理方式。改动后将在所有编辑框中全局生效。
              </p>
            </div>
            <div className="orbit-settings-field-control orbit-settings-field-control--block" style={{ paddingTop: "0.5rem" }}>
              <div className="orbit-voice-mode-grid">
                {[
                  { mode: "smooth", icon: "✨", label: "智能润色 (推荐)", desc: "自动去口癖词、自动改口替换与补充标点" },
                  { mode: "raw", icon: "🎙️", label: "保持原文", desc: "100% 还原真实口语转写，不使用 AI 润色" },
                  { mode: "bullets", icon: "📝", label: "要点列表", desc: "自动整理为 Markdown 结构要点清单" },
                  { mode: "formal", icon: "💼", label: "正式书面", desc: "重构为严密专业的公文与邮件正文体" },
                ].map((item) => {
                  const isSelected = selectedVoiceMode === item.mode;
                  return (
                    <button
                      key={item.mode}
                      type="button"
                      onClick={async () => {
                        const newMode = item.mode as VoiceTranscribeMode;
                        const prevMode = selectedVoiceMode;
                        setSelectedVoiceMode(newMode);
                        try {
                          const updated = await updateAppSettings({
                            voiceTranscribeMode: newMode,
                          });
                          setSettings(updated);
                          toast.success(`语音模式已切换为：${item.label}`);
                        } catch (err: any) {
                          setSelectedVoiceMode(prevMode);
                          if (shouldToastApiError(err)) {
                            toast.error(getApiErrorMessage(err, "保存语音模式失败"));
                          }
                        }
                      }}
                      className={`orbit-voice-mode-card ${isSelected ? "orbit-voice-mode-card--active" : ""}`}
                    >
                      <div className="orbit-voice-mode-title">
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                        {isSelected && <span style={{ marginLeft: "auto", color: "#10b981", fontWeight: "bold" }}>✓</span>}
                      </div>
                      <p className="orbit-voice-mode-desc">
                        {item.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </SettingsSection>

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
                  官方 DeepSeek API 接口服务（
                  <a
                    href="https://platform.deepseek.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="orbit-text-link"
                  >
                    platform.deepseek.com
                  </a>
                  ）
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

              <article className="orbit-settings-supplier-card">
                <div className="orbit-settings-connection-block-head">
                  <span className="orbit-settings-connection-block-title">
                    阿里百炼 (通义千问)
                  </span>
                </div>
                <p className="orbit-settings-connection-block-hint">
                  官方 DashScope API 接口服务（
                  <a
                    href="https://bailian.console.aliyun.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="orbit-text-link"
                  >
                    bailian.console.aliyun.com
                  </a>
                  ）
                </p>

                <div className="orbit-settings-supplier-credential">
                  <span className="orbit-settings-supplier-credential-label">
                    API Key
                  </span>
                  {showAlibabaKeyInput ? (
                    <div className="orbit-settings-supplier-credential-edit">
                      <div className="orbit-settings-key-row">
                        <input
                          type="password"
                          value={alibabaKey}
                          autoComplete="off"
                          placeholder={
                            settings?.hasAlibabaKey
                              ? "粘贴新 Key"
                              : "sk-..."
                          }
                          className="orbit-input orbit-settings-key-input"
                          onChange={(event) =>
                            setAlibabaKey(event.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="orbit-btn orbit-btn-sm orbit-settings-key-test"
                          disabled={
                            testingAlibaba ||
                            (!alibabaKey.trim() && !settings?.hasAlibabaKey)
                          }
                          onClick={() => void handleTestAlibaba()}
                        >
                          {testingAlibaba ? "检测中…" : "检测"}
                        </button>
                        {isAlibabaKeyDirty ? (
                          <button
                            type="button"
                            className="orbit-btn orbit-btn-sm"
                            disabled={savingAi}
                            onClick={() => void handleSaveAlibabaKey()}
                          >
                            {savingAi ? "保存中…" : "保存"}
                          </button>
                        ) : null}
                        {settings?.hasAlibabaKey ? (
                          <button
                            type="button"
                            className="orbit-btn-ghost orbit-btn-sm"
                            disabled={savingAi}
                            onClick={() => {
                              setEditingAlibabaKey(false);
                              setAlibabaKey("");
                            }}
                          >
                            取消
                          </button>
                        ) : null}
                      </div>
                      {!settings?.hasAlibabaKey ? (
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
                          onClick={() => setEditingAlibabaKey(true)}
                        >
                          更换
                        </button>
                        <button
                          type="button"
                          className="orbit-text-link"
                          disabled={testingAlibaba}
                          onClick={() => void handleTestAlibaba()}
                        >
                          {testingAlibaba ? "检测中…" : "检测"}
                        </button>
                        <button
                          type="button"
                          className="orbit-text-link orbit-settings-key-clear"
                          disabled={savingAi}
                          onClick={() => void handleClearAlibabaKey()}
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
                    const isSearching = modelSearch.trim().length > 0;
                    const isCollapsed = !isSearching && Boolean(collapsedGroupIds[group.id]);

                    return (
                      <section
                        key={group.id}
                        className={`orbit-settings-model-group${groupEnabled ? "" : " orbit-settings-model-group--off"}`}
                        aria-label={group.label}
                      >
                        <div className="orbit-settings-model-group-head">
                          <div className="orbit-settings-model-group-copy">
                            <button
                              type="button"
                              className="orbit-settings-model-group-toggle-btn"
                              aria-expanded={!isCollapsed}
                              aria-label={`${isCollapsed ? "展开" : "折叠"}供应商 ${group.label}`}
                              onClick={() => toggleGroupCollapse(group.id)}
                            >
                              <ChevronDownIcon
                                size="sm"
                                className={`orbit-settings-model-group-chevron${isCollapsed ? " orbit-settings-model-group-chevron--collapsed" : ""}`}
                              />
                              <span className="orbit-settings-provider-name">
                                {group.label}
                              </span>
                            </button>
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
                                  group.provider === "deepseek" ||
                                  group.provider === "alibaba"
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

                        {!isCollapsed ? (
                          <ul className="orbit-settings-model-provider-models">
                            {group.models.map((model) => {
                              const enabled = enabledModelIds.includes(model.id);
                              const blocked =
                                !groupEnabled ||
                                (group.requiresKey && !group.hasApiKey);
                              const spec = modelSpecs.get(model.id);
                              const isUserAddedCustom = Boolean(model.isCustom);

                              return (
                                <li
                                  key={model.id}
                                  className="orbit-settings-model-toggle-row"
                                >
                                  <div className="orbit-settings-model-toggle-main">
                                    <div className="orbit-settings-model-title-wrap">
                                      <span className="orbit-settings-model-toggle-label">
                                        {model.label}
                                      </span>
                                      {blocked ? (
                                        <span className="orbit-settings-model-toggle-hint">
                                          {!groupEnabled
                                            ? "供应商已关闭"
                                            : "需配置 Key"}
                                        </span>
                                      ) : null}
                                    </div>

                                    {spec ? (
                                      <div className="orbit-settings-model-spec-badges">
                                        <span className="orbit-spec-badge orbit-spec-badge--context">
                                          {formatContextWindow(spec.contextWindow)} 窗口
                                        </span>
                                        {spec.reasoning ? (
                                          <span className="orbit-spec-badge orbit-spec-badge--reasoning" title="支持深度思考/推理">
                                             <SparklesIcon size="sm" /> 思考
                                          </span>
                                        ) : null}
                                        {spec.supportsToolCalling ? (
                                          <span className="orbit-spec-badge orbit-spec-badge--tool" title="支持工具/函数调用">
                                            <WrenchIcon size="sm" /> 工具
                                          </span>
                                        ) : null}
                                        {spec.supportsVision ? (
                                          <span className="orbit-spec-badge orbit-spec-badge--vision" title="支持图片/视觉理解">
                                             <EyeIcon size="sm" /> 视觉
                                          </span>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </div>

                                  <div className="orbit-settings-model-toggle-actions">
                                    <button
                                      type="button"
                                      className="orbit-btn orbit-btn-sm orbit-btn-ghost"
                                      style={{ padding: "2px 8px", fontSize: "12px" }}
                                      onClick={() => openSpecEditor(model.id)}
                                    >
                                      规格
                                    </button>

                                    {isUserAddedCustom ? (
                                      <button
                                        type="button"
                                        className="orbit-text-link orbit-btn-sm orbit-text-danger"
                                        style={{ fontSize: "12px", color: "var(--color-danger, #ef4444)" }}
                                        onClick={() => void handleDeleteCustomModel(model)}
                                      >
                                        删除
                                      </button>
                                    ) : null}

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
                                  </div>
                                </li>
                              );
                            })}
                            <li className="orbit-settings-add-model-action-row" style={{ padding: "8px 12px" }}>
                              <button
                                type="button"
                                className="orbit-text-link orbit-btn-sm"
                                onClick={() => {
                                  setAddModelModalGroup(group);
                                  setNewModelDraft({
                                    id: "",
                                    label: "",
                                    contextWindow: 128_000,
                                    reasoning: false,
                                    supportsToolCalling: true,
                                    supportsVision: false,
                                    supportsFileInput: true,
                                    supportsImageOutput: false,
                                    supportsVideoOutput: false,
                                    supportsWebSearch: false,
                                  });
                                }}
                              >
                                + 在 {group.label} 下添加自定义模型
                              </button>
                            </li>
                          </ul>
                        ) : null}
                      </section>
                    );
                  })}
                </div>
              )}

              {/* Add Custom Model Modal */}
              {addModelModalGroup ? (
                <div className="orbit-spec-modal-backdrop" onClick={() => setAddModelModalGroup(null)}>
                  <div
                    className="orbit-spec-modal-dialog"
                    style={{ maxWidth: "32rem" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="orbit-spec-modal-header">
                      <div>
                        <h4 className="orbit-spec-modal-title">添加自定义模型</h4>
                        <p className="orbit-spec-modal-subtitle">
                          在 {addModelModalGroup.label} 供应商下配置并登记新模型
                        </p>
                      </div>
                      <button
                        type="button"
                        className="orbit-icon-btn orbit-btn-sm"
                        onClick={() => setAddModelModalGroup(null)}
                      >
                        <CloseIcon size="sm" />
                      </button>
                    </div>

                    <div className="orbit-spec-modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                      <div className="orbit-spec-field-group">
                        <label className="orbit-spec-field-label">模型 ID (Model ID)</label>
                        <input
                          type="text"
                          className="orbit-input"
                          placeholder="例如: deepseek-v4 或 qwen-vl-max"
                          value={newModelDraft.id}
                          onChange={(e) => setNewModelDraft({ ...newModelDraft, id: e.target.value })}
                          autoFocus
                        />
                      </div>

                      <div className="orbit-spec-field-group">
                        <label className="orbit-spec-field-label">显示名称 (Display Name / 可选)</label>
                        <input
                          type="text"
                          className="orbit-input"
                          placeholder="留空则直接使用模型 ID"
                          value={newModelDraft.label}
                          onChange={(e) => setNewModelDraft({ ...newModelDraft, label: e.target.value })}
                        />
                      </div>

                      <div className="orbit-spec-field-group">
                        <label className="orbit-spec-field-label">上下文窗口 (Tokens)</label>
                        <input
                          type="number"
                          className="orbit-input"
                          min={1000}
                          step={1000}
                          value={newModelDraft.contextWindow}
                          onChange={(e) =>
                            setNewModelDraft({
                              ...newModelDraft,
                              contextWindow: Number(e.target.value),
                            })
                          }
                        />
                        <div className="orbit-spec-pills">
                          {[64_000, 128_000, 256_000, 1_000_000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              className={`orbit-spec-pill-btn${newModelDraft.contextWindow === val ? " orbit-spec-pill-btn--active" : ""}`}
                              onClick={() => setNewModelDraft({ ...newModelDraft, contextWindow: val })}
                            >
                              {formatContextWindow(val)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Capabilities Categorized */}
                      <div className="orbit-spec-field-group">
                        <label className="orbit-spec-field-label" style={{ fontWeight: 600 }}>
                          模型客观能力声明 (Capabilities)
                        </label>

                        {/* INPUT */}
                        <div style={{ marginTop: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>INPUT (输入能力)</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>👁️ Vision (Image) - 图片输入</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={newModelDraft.supportsVision}
                                className={`orbit-toggle${newModelDraft.supportsVision ? " orbit-toggle--on" : ""}`}
                                onClick={() => setNewModelDraft({ ...newModelDraft, supportsVision: !newModelDraft.supportsVision })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>☁️ File Input - 文档文件输入</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={newModelDraft.supportsFileInput}
                                className={`orbit-toggle${newModelDraft.supportsFileInput ? " orbit-toggle--on" : ""}`}
                                onClick={() => setNewModelDraft({ ...newModelDraft, supportsFileInput: !newModelDraft.supportsFileInput })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* OUTPUT */}
                        <div style={{ marginTop: "12px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>OUTPUT (输出能力)</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🎨 Image Gen - 图片生成输出</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={newModelDraft.supportsImageOutput}
                                className={`orbit-toggle${newModelDraft.supportsImageOutput ? " orbit-toggle--on" : ""}`}
                                onClick={() => setNewModelDraft({ ...newModelDraft, supportsImageOutput: !newModelDraft.supportsImageOutput })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🎬 Video Gen - 视频生成输出</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={newModelDraft.supportsVideoOutput}
                                className={`orbit-toggle${newModelDraft.supportsVideoOutput ? " orbit-toggle--on" : ""}`}
                                onClick={() => setNewModelDraft({ ...newModelDraft, supportsVideoOutput: !newModelDraft.supportsVideoOutput })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* FEATURES */}
                        <div style={{ marginTop: "12px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>FEATURES (模型特性)</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🧠 Reasoning - 深度思考推理</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={newModelDraft.reasoning}
                                className={`orbit-toggle${newModelDraft.reasoning ? " orbit-toggle--on" : ""}`}
                                onClick={() => setNewModelDraft({ ...newModelDraft, reasoning: !newModelDraft.reasoning })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🛠 Tool Use - 工具/函数调用</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={newModelDraft.supportsToolCalling}
                                className={`orbit-toggle${newModelDraft.supportsToolCalling ? " orbit-toggle--on" : ""}`}
                                onClick={() => setNewModelDraft({ ...newModelDraft, supportsToolCalling: !newModelDraft.supportsToolCalling })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🔍 Web Search - 联网搜索能力</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={newModelDraft.supportsWebSearch}
                                className={`orbit-toggle${newModelDraft.supportsWebSearch ? " orbit-toggle--on" : ""}`}
                                onClick={() => setNewModelDraft({ ...newModelDraft, supportsWebSearch: !newModelDraft.supportsWebSearch })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="orbit-spec-modal-footer">
                      <button
                        type="button"
                        className="orbit-btn orbit-btn-sm"
                        onClick={() => setAddModelModalGroup(null)}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="orbit-btn orbit-btn-sm orbit-btn-primary"
                        disabled={!newModelDraft.id.trim() || savingCustomModel}
                        onClick={() => void handleCreateCustomModelWithSpecs()}
                      >
                        {savingCustomModel ? "添加中…" : "确认并添加模型"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Spec Editor Modal */}
              {editingSpecKey && specDraft ? (
                <div className="orbit-spec-modal-backdrop" onClick={closeSpecEditor}>
                  <div
                    className="orbit-spec-modal-dialog"
                    style={{ maxWidth: "32rem" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="orbit-spec-modal-header">
                      <div>
                        <h4 className="orbit-spec-modal-title">模型规格配置</h4>
                        <p className="orbit-spec-modal-subtitle">
                          {catalog.find((m) => m.id === editingSpecKey)?.label ?? editingSpecKey}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="orbit-icon-btn orbit-btn-sm"
                        onClick={closeSpecEditor}
                      >
                        <CloseIcon size="sm" />
                      </button>
                    </div>

                    <div className="orbit-spec-modal-body" style={{ maxHeight: "70vh", overflowY: "auto" }}>
                      <div className="orbit-spec-field-group">
                        <label className="orbit-spec-field-label">上下文窗口 (Tokens)</label>
                        <input
                          type="number"
                          className="orbit-input"
                          min={1000}
                          step={1000}
                          value={specDraft.contextWindow}
                          onChange={(e) =>
                            setSpecDraft({
                              ...specDraft,
                              contextWindow: Number(e.target.value),
                            })
                          }
                        />
                        <div className="orbit-spec-pills">
                          {[64_000, 128_000, 256_000, 1_000_000].map((val) => (
                            <button
                              key={val}
                              type="button"
                              className={`orbit-spec-pill-btn${specDraft.contextWindow === val ? " orbit-spec-pill-btn--active" : ""}`}
                              onClick={() => setSpecDraft({ ...specDraft, contextWindow: val })}
                            >
                              {formatContextWindow(val)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Capabilities Categorized */}
                      <div className="orbit-spec-field-group">
                        <label className="orbit-spec-field-label" style={{ fontWeight: 600 }}>
                          模型客观能力声明 (Capabilities)
                        </label>

                        {/* INPUT */}
                        <div style={{ marginTop: "6px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>INPUT (输入能力)</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>👁️ Vision (Image) - 图片输入</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={specDraft.supportsVision ?? false}
                                className={`orbit-toggle${(specDraft.supportsVision ?? false) ? " orbit-toggle--on" : ""}`}
                                onClick={() => setSpecDraft({ ...specDraft, supportsVision: !(specDraft.supportsVision ?? false) })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>☁️ File Input - 文档文件输入</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={specDraft.supportsFileInput ?? true}
                                className={`orbit-toggle${(specDraft.supportsFileInput ?? true) ? " orbit-toggle--on" : ""}`}
                                onClick={() => setSpecDraft({ ...specDraft, supportsFileInput: !(specDraft.supportsFileInput ?? true) })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* OUTPUT */}
                        <div style={{ marginTop: "12px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>OUTPUT (输出能力)</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🎨 Image Gen - 图片生成输出</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={specDraft.supportsImageOutput ?? false}
                                className={`orbit-toggle${(specDraft.supportsImageOutput ?? false) ? " orbit-toggle--on" : ""}`}
                                onClick={() => setSpecDraft({ ...specDraft, supportsImageOutput: !(specDraft.supportsImageOutput ?? false) })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🎬 Video Gen - 视频生成输出</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={specDraft.supportsVideoOutput ?? false}
                                className={`orbit-toggle${(specDraft.supportsVideoOutput ?? false) ? " orbit-toggle--on" : ""}`}
                                onClick={() => setSpecDraft({ ...specDraft, supportsVideoOutput: !(specDraft.supportsVideoOutput ?? false) })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* FEATURES */}
                        <div style={{ marginTop: "12px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase" }}>FEATURES (模型特性)</span>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🧠 Reasoning - 深度思考推理</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={specDraft.reasoning}
                                className={`orbit-toggle${specDraft.reasoning ? " orbit-toggle--on" : ""}`}
                                onClick={() => setSpecDraft({ ...specDraft, reasoning: !specDraft.reasoning })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🛠 Tool Use - 工具/函数调用</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={specDraft.supportsToolCalling ?? true}
                                className={`orbit-toggle${(specDraft.supportsToolCalling ?? true) ? " orbit-toggle--on" : ""}`}
                                onClick={() => setSpecDraft({ ...specDraft, supportsToolCalling: !(specDraft.supportsToolCalling ?? true) })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                            <div className="orbit-settings-model-spec-field orbit-settings-model-spec-field--switch">
                              <span>🔍 Web Search - 联网搜索能力</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={specDraft.supportsWebSearch ?? false}
                                className={`orbit-toggle${(specDraft.supportsWebSearch ?? false) ? " orbit-toggle--on" : ""}`}
                                onClick={() => setSpecDraft({ ...specDraft, supportsWebSearch: !(specDraft.supportsWebSearch ?? false) })}
                              >
                                <span className="orbit-toggle-thumb" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="orbit-spec-modal-footer">
                      {editingSpecKey && Boolean(catalog.find((m) => m.id === editingSpecKey)?.isCustom) ? (
                        <button
                          type="button"
                          className="orbit-text-link orbit-btn-sm orbit-text-danger"
                          style={{ color: "var(--color-danger, #ef4444)" }}
                          disabled={savingSpec}
                          onClick={() => {
                            const found = catalog.find((m) => m.id === editingSpecKey);
                            if (found) void handleDeleteCustomModel(found);
                          }}
                        >
                          删除此自定义模型
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="orbit-text-link orbit-btn-sm"
                          disabled={savingSpec}
                          onClick={() => void handleResetModelSpec(editingSpecKey)}
                        >
                          重置为内置默认
                        </button>
                      )}
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          type="button"
                          className="orbit-btn orbit-btn-sm"
                          disabled={savingSpec}
                          onClick={closeSpecEditor}
                        >
                          取消
                        </button>
                        <button
                          type="button"
                          className="orbit-btn orbit-btn-sm orbit-btn-primary"
                          disabled={savingSpec}
                          onClick={() => void handleSaveModelSpec(editingSpecKey)}
                        >
                          {savingSpec ? "保存中…" : "保存规格"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </SettingsField>
        </div>
      </SettingsSection>
    </>
  );
}
