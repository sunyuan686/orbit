import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  getApiErrorMessage,
  shouldToastApiError,
  updateAppSettings,
} from "../lib/api";
import {
  buildUnifiedChatModels,
  filterChatSelectableModels,
  modelRefForSettings,
  resolveEffectiveModelRef,
  resolveModelDisplayLabel,
  type UnifiedChatModel,
} from "../lib/ai-model-catalog";
import {
  mergeModelSpec,
  resolveSpecKey,
} from "../lib/ai-model-specs";
import { useAppSettings } from "../lib/appSettingsContext";
import { useToast } from "../lib/useToast";
import { AiIcon, CheckIcon, ChevronDownIcon, WrenchIcon } from "./OrbitIcons";

function getMenuLayout(trigger: DOMRect): CSSProperties {
  const margin = 8;
  const menuWidth = 280;
  const preferredHeight = 320;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = trigger.left;
  if (left + menuWidth > viewportWidth - margin) {
    left = Math.max(margin, viewportWidth - menuWidth - margin);
  }

  const spaceBelow = viewportHeight - trigger.bottom - margin;
  const spaceAbove = trigger.top - margin;
  const showAbove = spaceBelow < 220 && spaceAbove > spaceBelow;

  if (showAbove) {
    const maxHeight = Math.min(preferredHeight, spaceAbove);
    return {
      position: "fixed",
      left: `${left}px`,
      bottom: `${viewportHeight - trigger.top + margin}px`,
      width: `${menuWidth}px`,
      maxHeight: `${maxHeight}px`,
      zIndex: 1000,
    };
  }

  const maxHeight = Math.min(preferredHeight, spaceBelow);
  return {
    position: "fixed",
    left: `${left}px`,
    top: `${trigger.bottom + margin}px`,
    width: `${menuWidth}px`,
    maxHeight: `${maxHeight}px`,
    zIndex: 1000,
  };
}

export function AiModelPicker({
  disabled,
  onNavigateAway,
}: {
  disabled?: boolean;
  onNavigateAway?: () => void;
}) {
  const navigate = useNavigate();
  const { settings, setSettings } = useAppSettings();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [activeConfigTarget, setActiveConfigTarget] = useState<{
    model: UnifiedChatModel;
    rect: DOMRect;
  } | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBodyRef = useRef<HTMLDivElement>(null);

  const effectiveModelRef = settings
    ? resolveEffectiveModelRef(settings.aiProvider, settings.aiModel)
    : resolveEffectiveModelRef("deepseek", "");

  const catalog = useMemo(
    () =>
      buildUnifiedChatModels(
        settings?.aiBuiltinCatalog,
        settings?.aiConnections ?? [],
        settings?.aiModelSpecs ?? {}
      ),
    [settings?.aiBuiltinCatalog, settings?.aiConnections, settings?.aiModelSpecs]
  );

  const selectableModels = useMemo(() => {
    if (!settings) return [];
    return filterChatSelectableModels(catalog, settings.aiEnabledModels, {
      hasDeepseekKey: settings.hasDeepseekKey,
      hasAlibabaKey: settings.hasAlibabaKey,
      enabledProviders: settings.aiEnabledProviders,
      connections: settings.aiConnections,
    });
  }, [catalog, settings]);

  const triggerLabel = resolveModelDisplayLabel(effectiveModelRef, catalog);

  const reasoningLevelBadge = useMemo(() => {
    if (!effectiveModelRef || !settings) return null;
    const resolved = resolveSpecKey(effectiveModelRef);
    if (!resolved) return null;
    const builtin = settings.aiBuiltinModelSpecs?.[resolved.provider]?.[resolved.key];
    const userOverride = settings.aiModelSpecs?.[resolved.provider]?.[resolved.key];
    const spec = mergeModelSpec(builtin, userOverride);
    if (!spec.reasoning) return null;
    const level = spec.defaultReasoning ?? "low";
    return level.charAt(0).toUpperCase() + level.slice(1);
  }, [effectiveModelRef, settings?.aiBuiltinModelSpecs, settings?.aiModelSpecs]);

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
  }, [open, selectableModels.length]);

  useEffect(() => {
    if (!open) return;
    menuBodyRef.current?.scrollTo({ top: 0 });
    setActiveConfigTarget(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current?.contains(target) ||
        menuRef.current?.contains(target) ||
        (target as HTMLElement).closest?.(".orbit-ai-model-submenu-portal")
      ) {
        return;
      }
      setOpen(false);
      setActiveConfigTarget(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (activeConfigTarget) {
          setActiveConfigTarget(null);
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, activeConfigTarget]);

  async function handleModelSelect(model: UnifiedChatModel) {
    if (!settings || saving) return;
    if (model.id === effectiveModelRef) {
      setOpen(false);
      return;
    }

    const provider = model.provider;
    const settingsModel = modelRefForSettings(model.id);

    setSaving(true);
    try {
      const updated = await updateAppSettings({
        aiProvider: provider,
        aiModel: settingsModel,
      });
      setSettings(updated);
      setOpen(false);
      toast.success(`切换模型为 ${model.label}`);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "切换模型失败"));
      }
    } finally {
      setSaving(false);
    }
  }

  const goToSettings = () => {
    setOpen(false);
    onNavigateAway?.();
    navigate("/settings?tab=ai");
  };

  return (
    <div className="orbit-ai-model-picker" ref={rootRef}>
      <button
        type="button"
        className={`orbit-ai-model-pill${open ? " orbit-ai-model-pill--open" : ""}`}
        aria-label="选择模型"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled || saving}
        onClick={() => setOpen((val) => !val)}
      >
        <span className="orbit-ai-model-pill-icon" aria-hidden="true">
          <AiIcon size="sm" />
        </span>
        <span className="orbit-ai-model-pill-label">{triggerLabel}</span>
        {reasoningLevelBadge ? (
          <span
            className="orbit-ai-model-pill-reasoning"
            style={{
              color: "var(--color-text-muted)",
              fontSize: "0.8125rem",
              fontWeight: 500,
              marginLeft: "4px",
            }}
          >
            {reasoningLevelBadge}
          </span>
        ) : null}
        <ChevronDownIcon
          size="sm"
          className={`orbit-ai-model-pill-chevron${open ? " orbit-ai-model-pill-chevron--open" : ""}`}
        />
      </button>

      {open && menuStyle
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
                {selectableModels.length === 0 ? (
                  <p className="orbit-ai-model-menu-status">
                    暂无可用模型，请先在设置中配置供应商并启用模型。
                  </p>
                ) : (
                  selectableModels.map((model) => (
                    <ModelMenuItem
                      key={model.id}
                      model={model}
                      selected={effectiveModelRef === model.id}
                      isConfigOpen={activeConfigTarget?.model.id === model.id}
                      disabled={saving}
                      onSelect={() => void handleModelSelect(model)}
                      onToggleConfig={(rect) => {
                        setActiveConfigTarget((prev) =>
                          prev?.model.id === model.id ? null : { model, rect }
                        );
                      }}
                    />
                  ))
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

      {open && activeConfigTarget && menuRef.current
        ? createPortal(
            <ModelConfigSubmenuPortal
              model={activeConfigTarget.model}
              menuRect={menuRef.current.getBoundingClientRect()}
            />,
            document.body
          )
        : null}
    </div>
  );
}

function ModelMenuItem({
  model,
  selected,
  isConfigOpen,
  disabled,
  onSelect,
  onToggleConfig,
}: {
  model: UnifiedChatModel;
  selected: boolean;
  isConfigOpen: boolean;
  disabled?: boolean;
  onSelect: () => void;
  onToggleConfig: (rect: DOMRect) => void;
}) {
  const itemRef = useRef<HTMLButtonElement>(null);

  return (
    <button
      ref={itemRef}
      type="button"
      role="option"
      aria-selected={selected}
      className={`orbit-ai-model-menu-item${selected ? " orbit-ai-model-menu-item--selected" : ""}`}
      disabled={disabled}
      onClick={onSelect}
    >
      <span className="orbit-ai-model-menu-item-body">
        <span className="orbit-ai-model-menu-item-name">{model.label}</span>
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <button
          type="button"
          title="调节上下文与思考配置"
          className={`orbit-ai-model-item-edit-btn${isConfigOpen ? " orbit-ai-model-item-edit-btn--active" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (itemRef.current) {
              onToggleConfig(itemRef.current.getBoundingClientRect());
            }
          }}
        >
          <WrenchIcon size="sm" />
        </button>
        <span className="orbit-ai-model-menu-item-check" aria-hidden="true">
          {selected ? <CheckIcon size="sm" /> : null}
        </span>
      </div>
    </button>
  );
}

function ModelConfigSubmenuPortal({
  model,
  menuRect,
}: {
  model: UnifiedChatModel;
  menuRect: DOMRect;
}) {
  const { settings, setSettings } = useAppSettings();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const popoverWidth = 195;
  const popoverHeight = 240;
  const viewportWidth = window.innerWidth;

  // 悬空 Gap 设置为 12px
  let left = menuRect.right + 12;
  if (left + popoverWidth > viewportWidth - 8) {
    left = Math.max(8, menuRect.left - popoverWidth - 12);
  }

  // 底部与主菜单面板完全平齐 (Bottom Aligned)
  let top = menuRect.bottom - popoverHeight;
  if (top < 8) {
    top = Math.max(8, menuRect.top);
  }

  const style: CSSProperties = {
    position: "fixed",
    left: `${left}px`,
    top: `${top}px`,
    width: `${popoverWidth}px`,
    maxHeight: `${popoverHeight}px`,
    zIndex: 1100,
  };

  const resolved = resolveSpecKey(model.id);
  const builtinSpec = resolved
    ? settings?.aiBuiltinModelSpecs?.[resolved.provider]?.[resolved.key]
    : undefined;
  const userSpec = resolved
    ? settings?.aiModelSpecs?.[resolved.provider]?.[resolved.key]
    : undefined;
  const spec = mergeModelSpec(builtinSpec, userSpec);

  const baseContext = builtinSpec?.contextWindow ?? model.contextWindow ?? 200_000;
  const currentContext = spec.contextWindow ?? baseContext;
  const currentReasoning = spec.reasoning ?? model.capabilities.includes("reasoning");
  const currentLevel = spec.defaultReasoning ?? "low";

  const contextOptions = [
    { label: "200K", val: 200_000 },
    { label: "400K", val: 400_000 },
    { label: "1M", val: 1_000_000 },
  ];

  // 唯一匹配基础规格的最优 Default 选项
  const defaultContextVal = contextOptions.reduce((prev, curr) =>
    Math.abs(curr.val - baseContext) < Math.abs(prev.val - baseContext) ? curr : prev
  ).val;

  async function updateSpecConfig(updates: {
    contextWindow?: number;
    reasoning?: boolean;
    defaultReasoning?: "low" | "medium" | "high";
  }) {
    if (!settings || !resolved || saving) return;

    const currentSpecs = structuredClone(settings.aiModelSpecs ?? {});
    if (!currentSpecs[resolved.provider]) {
      currentSpecs[resolved.provider] = {};
    }
    const existing = currentSpecs[resolved.provider][resolved.key] ?? {};
    currentSpecs[resolved.provider][resolved.key] = {
      ...existing,
      name: existing.name || resolved.key,
      contextWindow: updates.contextWindow ?? currentContext,
      maxOutputTokens: existing.maxOutputTokens || 4_096,
      reasoning: updates.reasoning ?? currentReasoning,
      defaultReasoning: updates.defaultReasoning ?? currentLevel,
    };

    setSaving(true);
    try {
      const updated = await updateAppSettings({ aiModelSpecs: currentSpecs });
      setSettings(updated);
      toast.success("模型规格已更新");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更新模型配置失败"));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="orbit-ai-model-submenu orbit-ai-model-submenu-portal"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="orbit-ai-model-submenu-title">{model.label}</div>

      <div className="orbit-ai-model-submenu-body">
        <div className="orbit-ai-model-submenu-group">
          <div className="orbit-ai-model-submenu-label">CONTEXT</div>
          {contextOptions.map((opt) => {
            const isSelected = Math.abs(currentContext - opt.val) < 10_000;
            const isDefault = opt.val === defaultContextVal;
            return (
              <button
                key={opt.val}
                type="button"
                className={`orbit-ai-model-submenu-option${isSelected ? " orbit-ai-model-submenu-option--selected" : ""}`}
                onClick={() => void updateSpecConfig({ contextWindow: opt.val })}
              >
                <span>
                  {opt.label}
                  {isDefault ? (
                    <span className="orbit-ai-model-submenu-tag">Default</span>
                  ) : null}
                </span>
                {isSelected ? <CheckIcon size="sm" /> : null}
              </button>
            );
          })}
        </div>

        <div className="orbit-ai-model-submenu-group">
          <div className="orbit-ai-model-submenu-label">THINKING</div>
          {(["low", "medium", "high"] as const).map((level) => {
            const isSelected = currentReasoning && currentLevel === level;
            const isDefault = level === "low";
            return (
              <button
                key={level}
                type="button"
                className={`orbit-ai-model-submenu-option${isSelected ? " orbit-ai-model-submenu-option--selected" : ""}`}
                onClick={() =>
                  void updateSpecConfig({ reasoning: true, defaultReasoning: level })
                }
              >
                <span>
                  {level}
                  {isDefault ? (
                    <span className="orbit-ai-model-submenu-tag">Default</span>
                  ) : null}
                </span>
                {isSelected ? <CheckIcon size="sm" /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
