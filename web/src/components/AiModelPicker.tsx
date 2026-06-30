import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  fetchDeepseekModels,
  fetchWorkersAiModels,
  getApiErrorMessage,
  shouldToastApiError,
  updateAppSettings,
} from "../lib/api";
import {
  buildUnifiedChatModels,
  filterChatSelectableModels,
  inferProvider,
  modelRefForSettings,
  resolveEffectiveModelRef,
  resolveModelDisplayLabel,
  type UnifiedChatModel,
} from "../lib/ai-model-catalog";
import { useAppSettings } from "../lib/appSettingsContext";
import { useToast } from "../lib/useToast";
import { AiIcon, CheckIcon, ChevronDownIcon } from "./OrbitIcons";

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
  const [workersModels, setWorkersModels] = useState<Awaited<ReturnType<typeof fetchWorkersAiModels>>["models"]>([]);
  const [deepseekModels, setDeepseekModels] = useState<Awaited<ReturnType<typeof fetchDeepseekModels>>["models"]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBodyRef = useRef<HTMLDivElement>(null);

  const effectiveModelRef = settings
    ? resolveEffectiveModelRef(settings.aiProvider, settings.aiModel)
    : resolveEffectiveModelRef("deepseek", "");

  const catalog = useMemo(
    () =>
      buildUnifiedChatModels(
        workersModels,
        deepseekModels,
        settings?.aiConnections ?? []
      ),
    [workersModels, deepseekModels, settings?.aiConnections]
  );

  const selectableModels = useMemo(() => {
    if (!settings) return [];
    return filterChatSelectableModels(catalog, settings.aiEnabledModels, {
      hasDeepseekKey: settings.hasDeepseekKey,
      enabledProviders: settings.aiEnabledProviders,
      connections: settings.aiConnections,
    });
  }, [catalog, settings]);

  const recommendedModels = useMemo(
    () => selectableModels.filter((model) => model.recommended),
    [selectableModels]
  );

  const otherModels = useMemo(
    () => selectableModels.filter((model) => !model.recommended),
    [selectableModels]
  );

  const triggerLabel = resolveModelDisplayLabel(effectiveModelRef, catalog);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    void Promise.all([fetchWorkersAiModels(), fetchDeepseekModels()])
      .then(([workers, deepseek]) => {
        if (cancelled) return;
        setWorkersModels(workers.models);
        setDeepseekModels(deepseek.models);
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
  }, [open, loading, selectableModels.length]);

  useEffect(() => {
    if (!open) return;
    menuBodyRef.current?.scrollTo({ top: 0 });
  }, [open]);

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

  async function handleModelSelect(model: UnifiedChatModel) {
    if (!settings || saving) return;

    const provider = inferProvider(model.id);
    const nextModel = modelRefForSettings(model.id);
    const currentStored = settings.aiModel.trim() || null;

    if (settings.aiProvider === provider && currentStored === nextModel) {
      setOpen(false);
      return;
    }

    setSaving(true);
    try {
      const next = await updateAppSettings({
        aiProvider: provider,
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
                {loading ? (
                  <p className="orbit-ai-model-menu-status">加载模型列表…</p>
                ) : selectableModels.length === 0 ? (
                  <p className="orbit-ai-model-menu-status">
                    暂无可用模型，请先在设置中配置供应商并启用模型。
                  </p>
                ) : (
                  <>
                    {recommendedModels.length > 0 ? (
                      <div className="orbit-ai-model-menu-section">
                        <div className="orbit-ai-model-menu-section-label">推荐</div>
                        {recommendedModels.map((model) => (
                          <ModelMenuItem
                            key={model.id}
                            model={model}
                            selected={effectiveModelRef === model.id}
                            disabled={saving}
                            onSelect={() => void handleModelSelect(model)}
                          />
                        ))}
                      </div>
                    ) : null}

                    {otherModels.length > 0 ? (
                      <div className="orbit-ai-model-menu-section">
                        {recommendedModels.length > 0 ? (
                          <div className="orbit-ai-model-menu-section-label">其他</div>
                        ) : null}
                        {otherModels.map((model) => (
                          <ModelMenuItem
                            key={model.id}
                            model={model}
                            selected={effectiveModelRef === model.id}
                            disabled={saving}
                            onSelect={() => void handleModelSelect(model)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </>
                )}
              </div>

              <div className="orbit-ai-model-menu-footer">
                <button
                  type="button"
                  className="orbit-ai-model-menu-settings"
                  onClick={goToSettings}
                >
                  管理模型
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function ModelMenuItem({
  model,
  selected,
  disabled,
  onSelect,
}: {
  model: UnifiedChatModel;
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
