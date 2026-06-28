import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_AI_MODELS,
  fetchWorkersAiModels,
  getApiErrorMessage,
  resolveAiModelId,
  shouldToastApiError,
  updateAppSettings,
  type AiProvider,
  type WorkersAiModelOption,
} from "../lib/api";
import { useAppSettings } from "../lib/appSettingsContext";
import { useToast } from "../lib/useToast";
import { AiIcon, CheckIcon, ChevronDownIcon } from "./OrbitIcons";

const PROVIDER_OPTIONS: { id: AiProvider; label: string }[] = [
  { id: "workers-ai", label: "Cloudflare Workers AI" },
  { id: "deepseek", label: "DeepSeek" },
];

function formatContextWindow(contextWindow?: number): string | null {
  if (!contextWindow) return null;
  if (contextWindow >= 1_000_000) {
    return `${(contextWindow / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (contextWindow >= 1000) {
    return `${Math.round(contextWindow / 1000)}k`;
  }
  return String(contextWindow);
}

function getEffectiveModelId(aiProvider: AiProvider, aiModel: string): string {
  return resolveAiModelId(aiProvider, aiModel);
}

function getModelShortLabel(modelId: string): string {
  return modelId.split("/").pop() ?? modelId;
}

function getTriggerLabel(_aiProvider: AiProvider, effectiveModelId: string): string {
  return getModelShortLabel(effectiveModelId);
}

function getMenuLayout(trigger: DOMRect): CSSProperties {
  const gap = 8;
  const width = Math.min(352, window.innerWidth - 16);
  const left = Math.max(8, Math.min(trigger.left, window.innerWidth - width - 8));
  const maxHeightCap = Math.min(448, window.innerHeight - 16);
  const spaceAbove = trigger.top - gap;
  const spaceBelow = window.innerHeight - trigger.bottom - gap;
  const openAbove = spaceAbove >= 240 || spaceAbove >= spaceBelow;

  if (openAbove) {
    return {
      position: "fixed",
      left,
      bottom: window.innerHeight - trigger.top + gap,
      width,
      maxHeight: Math.min(maxHeightCap, spaceAbove),
      zIndex: 70,
    };
  }

  return {
    position: "fixed",
    left,
    top: trigger.bottom + gap,
    width,
    maxHeight: Math.min(maxHeightCap, spaceBelow),
    zIndex: 70,
  };
}

interface AiModelPickerProps {
  disabled?: boolean;
  onNavigateAway?: () => void;
}

export function AiModelPicker({
  disabled = false,
  onNavigateAway,
}: AiModelPickerProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const { settings, setSettings } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<WorkersAiModelOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBodyRef = useRef<HTMLDivElement>(null);

  const aiProvider = settings?.aiProvider ?? "workers-ai";
  const displayProvider =
    aiProvider === "openai" || aiProvider === "anthropic" ? "workers-ai" : aiProvider;
  const effectiveModelId = settings
    ? getEffectiveModelId(displayProvider, settings.aiModel)
    : DEFAULT_AI_MODELS["workers-ai"];

  const providerOptions = useMemo(() => {
    const selected = PROVIDER_OPTIONS.find((option) => option.id === displayProvider);
    const rest = PROVIDER_OPTIONS.filter((option) => option.id !== displayProvider);
    return selected ? [selected, ...rest] : PROVIDER_OPTIONS;
  }, [displayProvider]);

  const chatModels = useMemo(
    () => models.filter((model) => model.task === "Text Generation"),
    [models]
  );

  const recommendedModels = useMemo(
    () => chatModels.filter((model) => model.recommended),
    [chatModels]
  );

  const otherChatModels = useMemo(
    () => chatModels.filter((model) => !model.recommended),
    [chatModels]
  );

  const triggerLabel = getTriggerLabel(displayProvider, effectiveModelId);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    void fetchWorkersAiModels()
      .then((result) => {
        if (!cancelled) setModels(result.models);
      })
      .catch((err) => {
        if (!cancelled && shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载模型列表失败"));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, toast]);

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuLayout() {
      const trigger = rootRef.current?.getBoundingClientRect();
      if (!trigger) return;
      setMenuStyle(getMenuLayout(trigger));
    }

    updateMenuLayout();
    window.addEventListener("resize", updateMenuLayout);
    window.addEventListener("scroll", updateMenuLayout, true);
    return () => {
      window.removeEventListener("resize", updateMenuLayout);
      window.removeEventListener("scroll", updateMenuLayout, true);
    };
  }, [open, displayProvider, loading, recommendedModels.length, otherChatModels.length]);

  useEffect(() => {
    if (!open) return;
    menuBodyRef.current?.scrollTo({ top: 0 });
  }, [open, displayProvider]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function goToSettings() {
    setOpen(false);
    onNavigateAway?.();
    navigate("/settings?tab=ai");
  }

  async function handleProviderSelect(nextProvider: AiProvider) {
    if (!settings || saving) return;
    if (nextProvider === settings.aiProvider) return;

    setSaving(true);
    try {
      const next = await updateAppSettings({
        aiProvider: nextProvider,
        aiModel: null,
      });
      setSettings(next);
      toast.success("模型提供商已切换");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "切换失败"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleWorkersModelSelect(modelId: string) {
    if (!settings || saving) return;
    const nextModel =
      modelId === DEFAULT_AI_MODELS["workers-ai"] ? null : modelId;

    if (
      settings.aiProvider === "workers-ai" &&
      (settings.aiModel.trim() || "") === (nextModel ?? "")
    ) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const next = await updateAppSettings({
        aiProvider: "workers-ai",
        aiModel: nextModel,
      });
      setSettings(next);
      setOpen(false);
      toast.success("模型已切换");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "切换模型失败"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="orbit-ai-model-picker" ref={rootRef}>
      <button
        type="button"
        className={`orbit-ai-model-pill${open ? " orbit-ai-model-pill--open" : ""}`}
        aria-label="选择模型"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled || saving}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="orbit-ai-model-pill-icon" aria-hidden="true">
          <AiIcon size="sm" />
        </span>
        <span className="orbit-ai-model-pill-label">{triggerLabel}</span>
        <ChevronDownIcon
          size="sm"
          className={`orbit-ai-model-pill-chevron${open ? " orbit-ai-model-pill-chevron--open" : ""}`}
        />
      </button>

      {open
        ? createPortal(
            <div
              className="orbit-ai-model-menu orbit-ai-model-menu--portal"
              ref={menuRef}
              style={menuStyle}
              role="listbox"
              aria-label="选择模型"
            >
              <div className="orbit-ai-model-menu-header">选择模型</div>

              <div className="orbit-ai-model-menu-body" ref={menuBodyRef}>
                {displayProvider === "workers-ai" ? (
                  loading ? (
                    <p className="orbit-ai-model-menu-status">加载模型列表…</p>
                  ) : chatModels.length === 0 ? (
                    <p className="orbit-ai-model-menu-status">暂无可用模型</p>
                  ) : (
                    <>
                      {recommendedModels.length > 0 ? (
                        <div className="orbit-ai-model-menu-section">
                          <div className="orbit-ai-model-menu-section-label">推荐</div>
                          {recommendedModels.map((model) => (
                            <WorkersModelMenuItem
                              key={model.id}
                              model={model}
                              selected={effectiveModelId === model.id}
                              disabled={saving}
                              onSelect={() => void handleWorkersModelSelect(model.id)}
                            />
                          ))}
                        </div>
                      ) : null}

                      {otherChatModels.length > 0 ? (
                        <div className="orbit-ai-model-menu-section">
                          <div className="orbit-ai-model-menu-section-label">文本生成</div>
                          {otherChatModels.map((model) => (
                            <WorkersModelMenuItem
                              key={model.id}
                              model={model}
                              selected={effectiveModelId === model.id}
                              disabled={saving}
                              onSelect={() => void handleWorkersModelSelect(model.id)}
                            />
                          ))}
                        </div>
                      ) : null}
                    </>
                  )
                ) : (
                  <div className="orbit-ai-model-menu-section">
                    <div className="orbit-ai-model-menu-section-label">当前模型</div>
                    <div className="orbit-ai-model-menu-note">
                      使用 {PROVIDER_OPTIONS.find((option) => option.id === displayProvider)?.label}{" "}
                      的模型 <code>{effectiveModelId}</code>
                      。可在设置中配置 API Key 与自定义模型 ID。
                    </div>
                  </div>
                )}
              </div>

              <div className="orbit-ai-model-menu-section orbit-ai-model-menu-section--providers">
                <div className="orbit-ai-model-menu-section-label">提供商</div>
                <div className="orbit-ai-model-provider-grid">
                  {providerOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      role="option"
                      aria-selected={displayProvider === option.id}
                      className={`orbit-ai-model-provider-chip${displayProvider === option.id ? " orbit-ai-model-provider-chip--selected" : ""}`}
                      disabled={saving}
                      title={`默认 ${getModelShortLabel(DEFAULT_AI_MODELS[option.id])}`}
                      onClick={() => void handleProviderSelect(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="orbit-ai-model-menu-footer">
                <button
                  type="button"
                  className="orbit-ai-model-menu-settings"
                  onClick={goToSettings}
                >
                  更多模型与 API 设置
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function WorkersModelMenuItem({
  model,
  selected,
  disabled,
  onSelect,
}: {
  model: WorkersAiModelOption;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const contextLabel = formatContextWindow(model.contextWindow);

  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`orbit-ai-model-menu-item${selected ? " orbit-ai-model-menu-item--selected" : ""}`}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="orbit-ai-model-menu-item-body">
        <span className="orbit-ai-model-menu-item-name">{model.label}</span>
        <span className="orbit-ai-model-menu-item-meta">
          {model.capabilities.length > 0
            ? model.capabilities.join(" · ")
            : null}
          {model.capabilities.length > 0 && contextLabel ? " · " : null}
          {contextLabel ? `${contextLabel} ctx` : null}
        </span>
      </span>
      <span className="orbit-ai-model-menu-item-check" aria-hidden="true">
        {selected ? <CheckIcon size="sm" /> : null}
      </span>
    </button>
  );
}
