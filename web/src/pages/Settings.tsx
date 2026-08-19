import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  authClient,
  createInvite,
  fetchActiveInvite,
  fetchSpaceStatus,
  formatDateTime,
  getApiErrorMessage,
  shouldToastApiError,
  updateProfile,
  type SpaceStatus,
} from "../lib/api";
import {
  ACCENT_PRESET_LIST,
  CANVAS_BG_LIST,
  GRAIN_PRESETS,
  FONT_MODE_LIST,
  FONT_SIZE_LIST,
  applyAccentPreset,
  applyCanvasBg,
  applyGrainOpacity,
  applyFontMode,
  applyReadingFontSize,
  getSavedAccentTheme,
  getSavedCanvasBg,
  getSavedGrainOpacity,
  getSavedFontMode,
  getSavedFontSize,
  type CanvasBg,
  type AccentTheme,
  type FontMode,
  type ReadingFontSize,
} from "../lib/accent";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../hooks/useToast";
import { ApiTokenSettingsPanel } from "../components/ApiTokenSettingsPanel";
import { AiProvidersSettingsPanel } from "../components/AiProvidersSettingsPanel";
import { FeishuIntegrationPanel } from "../components/FeishuIntegrationPanel";
import { NotificationsSettingsPanel } from "../components/NotificationsSettingsPanel";
import {
  AiIcon,
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  MemoriesIcon,
  MessageIcon,
  PaletteIcon,
  TimelineIcon,
  UserIcon,
} from "../components/OrbitIcons";
import { BirthdaySettingsField } from "../components/BirthdaySettingsField";
import { SpaceSettingsPanel } from "../components/SpaceSettingsPanel";
import { CompanionSettingsPanel } from "../components/CompanionSettingsPanel";
import { useMaxWidthMd } from "../hooks/useBreakpoint";
import { Button, Input, Container, Section, Field, Stack } from "../components/ui";

type SettingsTab =
  | "appearance"
  | "profile"
  | "security"
  | "ai"
  | "space"
  | "integrations"
  | "notifications"
  | "companion"
  | "api-tokens";

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
        id: "profile",
        label: "个人资料",
        description: "爱称与生日",
        icon: (props) => <UserIcon {...props} />,
      },
      {
        id: "security",
        label: "登录与安全",
        description: "邮箱与密码",
        icon: (props) => <KeyIcon {...props} />,
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
    id: "integrations",
    label: "连接 / 集成",
    tabs: [
      {
        id: "integrations",
        label: "飞书",
        description: "Bot 凭证、身份映射与 Webhook",
        icon: (props) => <MessageIcon {...props} />,
      },
      {
        id: "notifications",
        label: "通知",
        description: "站内与飞书推送偏好",
        icon: (props) => <BellIcon {...props} />,
      },
      {
        id: "api-tokens",
        label: "API Token",
        description: "脚本与外部工具访问",
        icon: (props) => <KeyIcon {...props} />,
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
        description: "供应商、模型与 API Key",
        icon: (props) => <AiIcon {...props} />,
      },
      {
        id: "companion",
        label: "主动触达",
        description: "陪伴时间、安静时段与调度",
        icon: (props) => <MemoriesIcon {...props} />,
      },
    ],
  },
];

function isSettingsTab(value: string | null): value is SettingsTab {
  return (
    value === "appearance" ||
    value === "profile" ||
    value === "security" ||
    value === "ai" ||
    value === "space" ||
    value === "integrations" ||
    value === "notifications" ||
    value === "companion" ||
    value === "api-tokens"
  );
}

/** Legacy `tab=account` → 个人资料 */
function resolveSettingsTab(value: string | null): SettingsTab | null {
  if (value === "account") return "profile";
  return isSettingsTab(value) ? value : null;
}

export function SettingsPage() {
  const toast = useToast();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const isMobile = useMaxWidthMd();
  const tabParam = searchParams.get("tab");
  const resolvedTab = resolveSettingsTab(tabParam);
  const activeTab: SettingsTab = resolvedTab ?? "appearance";
  const showMobileMenu = isMobile && !resolvedTab;
  const showMobileDetail = isMobile && Boolean(resolvedTab);

  const [accentPreset, setAccentPreset] = useState<AccentTheme>(() => getSavedAccentTheme());

  const [email, setEmail] = useState("");
  const [emailDirty, setEmailDirty] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [displayNameDirty, setDisplayNameDirty] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const [spaceStatus, setSpaceStatus] = useState<SpaceStatus | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteExpiresAt, setInviteExpiresAt] = useState<number | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  useEffect(() => {
    setPageTitle("设置");
  }, []);

  useEffect(() => {
    if (!session?.user?.email) return;
    setEmail(session.user.email);
    setEmailDirty(false);
  }, [session?.user?.email]);

  useEffect(() => {
    if (!session?.user?.name) return;
    setDisplayName(session.user.name);
    setDisplayNameDirty(false);
  }, [session?.user?.name]);

  useEffect(() => {
    if (activeTab !== "profile") return;
    let cancelled = false;
    void (async () => {
      try {
        const status = await fetchSpaceStatus();
        if (cancelled) return;
        setSpaceStatus(status);
        if (status.userCount === 1) {
          const invite = await fetchActiveInvite();
          if (cancelled) return;
          if (invite.active && invite.url) {
            setInviteUrl(invite.url);
            setInviteExpiresAt(invite.expiresAt ?? null);
          }
        }
      } catch {
        if (!cancelled) setSpaceStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  function setTab(tab: SettingsTab) {
    setSearchParams({ tab }, { replace: true });
  }

  const [canvasBg, setCanvasBgState] = useState<CanvasBg>(() => getSavedCanvasBg());
  const [grainOpacity, setGrainOpacityState] = useState<number>(() => getSavedGrainOpacity());
  const [fontMode, setFontModeState] = useState<FontMode>(() => getSavedFontMode());
  const [fontSize, setFontSizeState] = useState<ReadingFontSize>(() => getSavedFontSize());

  function backToMobileMenu() {
    setSearchParams({}, { replace: true });
  }

  function handleAccentSelect(preset: AccentTheme) {
    setAccentPreset(preset);
    applyAccentPreset(preset);
    toast.success(`主题色已切换为「${ACCENT_PRESET_LIST.find((c) => c.id === preset)?.label}」`);
  }

  function handleCanvasBgSelect(bg: CanvasBg) {
    setCanvasBgState(bg);
    applyCanvasBg(bg);
    toast.success(`画布已切换为「${CANVAS_BG_LIST.find((c) => c.id === bg)?.label}」`);
  }

  function handleGrainChange(val: number) {
    setGrainOpacityState(val);
    applyGrainOpacity(val);
  }

  function handleFontModeSelect(mode: FontMode) {
    setFontModeState(mode);
    applyFontMode(mode);
    toast.success(`排版风格已切换为「${FONT_MODE_LIST.find((f) => f.id === mode)?.label}」`);
  }

  function handleFontSizeSelect(size: ReadingFontSize) {
    setFontSizeState(size);
    applyReadingFontSize(size);
    toast.success(`阅读字号已切换为「${FONT_SIZE_LIST.find((s) => s.id === size)?.label}」`);
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
        callbackURL: "/settings?tab=security",
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

  async function handleSaveDisplayName(event: React.FormEvent) {
    event.preventDefault();
    const nextName = displayName.trim();
    if (!nextName || savingDisplayName) return;
    if (nextName === session?.user?.name) {
      toast.error("爱称与当前相同");
      return;
    }
    setSavingDisplayName(true);
    try {
      await updateProfile(nextName);
      await refetchSession();
      setDisplayNameDirty(false);
      toast.success("爱称已更新");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更新失败"));
      }
    } finally {
      setSavingDisplayName(false);
    }
  }

  async function handleCreateInvite() {
    if (creatingInvite) return;
    setCreatingInvite(true);
    try {
      const invite = await createInvite();
      setInviteUrl(invite.url);
      setInviteExpiresAt(invite.expiresAt);
      toast.success("邀请链接已生成");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "生成邀请失败"));
      }
    } finally {
      setCreatingInvite(false);
    }
  }

  async function handleCopyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("已复制邀请链接");
    } catch {
      toast.error("复制失败");
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
    <Container
      size="standard"
      className="orbit-settings-content"
      data-page="settings"
      data-mobile-view={isMobile ? (showMobileMenu ? "menu" : "detail") : undefined}
    >
      {!(isMobile && showMobileDetail) ? (
        <header className="orbit-settings-page-header">
          <h1 className="orbit-page-title">设置</h1>
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
                <h2 className="orbit-settings-panel-title">主题与外观</h2>
                <p className="orbit-settings-panel-desc">
                  定制当前设备的色彩、纸张底色与排版偏好，即时生效。
                </p>
              </header>

              {/* 1. 品牌主题色 */}
              <Section title="主题色">
                <Field hint="用于高光按钮、金句引线与状态圆点。">
                  <div
                    className="orbit-settings-theme-grid"
                    role="radiogroup"
                    aria-label="主题色"
                  >
                    {ACCENT_PRESET_LIST.map((preset) => {
                      const isSelected = accentPreset === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`orbit-theme-card${isSelected ? " orbit-theme-card--active" : ""}`}
                          onClick={() => handleAccentSelect(preset.id)}
                        >
                          <div className="orbit-theme-card-header">
                            <span
                              className="orbit-theme-card-dot"
                              style={{ backgroundColor: preset.colorPreview }}
                              aria-hidden="true"
                            />
                            <span className="orbit-theme-card-title">{preset.label}</span>
                          </div>
                          <span className="orbit-theme-card-desc">{preset.subLabel}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </Section>

              {/* 2. 画布底色 */}
              <Section title="纸张底色">
                <Field hint="全站背景与卡片容器的纸张色温。">
                  <div
                    className="orbit-settings-canvas-grid"
                    role="radiogroup"
                    aria-label="纸张底色"
                  >
                    {CANVAS_BG_LIST.map((bg) => {
                      const isSelected = canvasBg === bg.id;
                      return (
                        <button
                          key={bg.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`orbit-canvas-card${isSelected ? " orbit-canvas-card--active" : ""}`}
                          onClick={() => handleCanvasBgSelect(bg.id)}
                        >
                          <div className="orbit-canvas-card-meta">
                            <span
                              className="orbit-canvas-card-swatch"
                              style={{ backgroundColor: bg.colorPreview }}
                              aria-hidden="true"
                            />
                            <span className="orbit-canvas-card-title">{bg.label}</span>
                          </div>
                          <span className="orbit-canvas-card-desc">{bg.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </Section>

              {/* 3. 排版风格 */}
              <Section title="排版风格">
                <Field hint="全站标题与正文字体风格。">
                  <div
                    className="orbit-settings-font-grid"
                    role="radiogroup"
                    aria-label="排版风格"
                  >
                    {FONT_MODE_LIST.map((mode) => {
                      const isSelected = fontMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`orbit-font-card${isSelected ? " orbit-font-card--active" : ""}`}
                          onClick={() => handleFontModeSelect(mode.id)}
                        >
                          <div className="orbit-font-card-meta">
                            <span className="orbit-font-card-title">{mode.label}</span>
                            <span className="orbit-font-card-badge">{mode.subLabel}</span>
                          </div>
                          <span className="orbit-font-card-desc">{mode.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </Section>

              {/* 4. 阅读字号 */}
              <Section title="阅读字号">
                <Field hint="长篇日记与正文字阶大小。">
                  <div
                    className="orbit-settings-fontsize-grid"
                    role="radiogroup"
                    aria-label="阅读字号"
                  >
                    {FONT_SIZE_LIST.map((size) => {
                      const isSelected = fontSize === size.id;
                      return (
                        <button
                          key={size.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`orbit-fontsize-card${isSelected ? " orbit-fontsize-card--active" : ""}`}
                          onClick={() => handleFontSizeSelect(size.id)}
                        >
                          <span className="orbit-fontsize-card-title">{size.label}</span>
                          <span className="orbit-fontsize-card-desc">{size.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </Section>

              {/* 5. 纸质微颗粒感 */}
              <Section title="纸张微颗粒">
                <Field hint="为画布增加细腻的纸质触感。">
                  <div className="orbit-grain-control-wrap">
                    <div className="orbit-grain-presets-row">
                      {GRAIN_PRESETS.map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          className={`orbit-chip-btn${Math.abs(grainOpacity - preset.val) < 0.005 ? " orbit-chip-btn--active" : ""}`}
                          onClick={() => handleGrainChange(preset.val)}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                    <div className="orbit-grain-slider-row">
                      <input
                        type="range"
                        className="orbit-grain-slider"
                        min="0"
                        max="15"
                        step="0.5"
                        value={Math.round(grainOpacity * 1000) / 10}
                        onChange={(e) => handleGrainChange(parseFloat(e.target.value) / 100)}
                      />
                      <span className="orbit-grain-val-text">
                        {(grainOpacity * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </Field>
              </Section>
            </>
          ) : null}

          {activeTab === "profile" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">个人资料</h2>
                <p className="orbit-settings-panel-desc">
                  {isMobile
                    ? "管理爱称与生日。"
                    : "管理爱称与生日。爱称用于内容署名展示。"}
                </p>
              </header>

              <Section title="爱称">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveDisplayName(e);
                  }}
                >
                  <Field
                    label="内容署名"
                    hint="用于日记、信箱与留言板的内容署名，修改后历史内容展示会同步更新。"
                  >
                    <Stack direction="row" gap="sm" align="center" style={{ maxWidth: "20rem" }}>
                      <Input
                        id="settings-display-name"
                        value={displayName}
                        maxLength={16}
                        sizeVariant="md"
                        style={{ flex: 1 }}
                        onChange={(event) => {
                          setDisplayName(event.target.value);
                          setDisplayNameDirty(
                            event.target.value.trim() !== (session?.user?.name ?? "")
                          );
                        }}
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="md"
                        disabled={savingDisplayName || !displayNameDirty || !displayName.trim()}
                        loading={savingDisplayName}
                      >
                        保存爱称
                      </Button>
                    </Stack>
                  </Field>
                </form>
              </Section>

              <Section title="生日与纪念提醒">
                <BirthdaySettingsField />
              </Section>

              {spaceStatus?.userCount === 1 ? (
                <Section title="邀请另一半">
                  <Field
                    label="专属邀请链接"
                    hint="有效期 7 天，使用后失效。请复制链接发给对方。"
                  >
                    {inviteUrl ? (
                      <div className="orbit-settings-inline-form orbit-settings-inline-form--wide">
                        <Input
                          mono
                          readOnly
                          value={inviteUrl}
                          aria-label="邀请链接"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void handleCopyInvite()}
                        >
                          复制链接
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={creatingInvite}
                        loading={creatingInvite}
                        onClick={() => void handleCreateInvite()}
                      >
                        生成邀请链接
                      </Button>
                    )}
                    {inviteExpiresAt ? (
                      <p className="orbit-settings-field-hint">
                        过期时间：{formatDateTime(inviteExpiresAt)}
                      </p>
                    ) : null}
                  </Field>
                </Section>
              ) : null}
            </>
          ) : null}

          {activeTab === "security" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">登录与安全</h2>
                <p className="orbit-settings-panel-desc">
                  管理你的登录邮箱与账户凭证安全。
                </p>
              </header>

              <Section title="账户邮箱">
                <form
                  className="orbit-settings-form-block"
                  onSubmit={(e) => void handleUpdateEmail(e)}
                >
                  <Field
                    label="登录邮箱"
                    hint="用于登录空间与接收通知。"
                  >
                    <div className="orbit-settings-inline-form">
                      <Input
                        id="settings-email"
                        type="email"
                        value={email}
                        autoComplete="email"
                        placeholder="your-email@example.com"
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setEmailDirty(
                            event.target.value.trim() !== (session?.user?.email ?? "")
                          );
                        }}
                      />
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={savingEmail || !emailDirty}
                        loading={savingEmail}
                      >
                        保存邮箱
                      </Button>
                    </div>
                  </Field>
                </form>
              </Section>

              <Section title="修改密码">
                <form
                  className="orbit-settings-form-block"
                  onSubmit={(e) => void handleUpdatePassword(e)}
                >
                  <Stack gap="md">
                    <Field
                      label="当前密码"
                      hint="请输入当前正在使用的账户密码。"
                    >
                      <div className="orbit-password-input-wrapper">
                        <Input
                          id="settings-current-password"
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          autoComplete="current-password"
                          placeholder="当前密码"
                          onChange={(event) => setCurrentPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          className="orbit-password-toggle-btn"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                          aria-label={showCurrentPassword ? "隐藏密码" : "显示密码"}
                          title={showCurrentPassword ? "隐藏密码" : "显示密码"}
                        >
                          {showCurrentPassword ? <EyeOffIcon size="sm" /> : <EyeIcon size="sm" />}
                        </button>
                      </div>
                    </Field>

                    <Field
                      label="设置新密码"
                      hint="新密码长度至少需为 8 位字符。"
                    >
                      <div className="orbit-password-input-wrapper">
                        <Input
                          id="settings-new-password"
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          autoComplete="new-password"
                          placeholder="新密码 (至少 8 位)"
                          minLength={8}
                          onChange={(event) => setNewPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          className="orbit-password-toggle-btn"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          aria-label={showNewPassword ? "隐藏密码" : "显示密码"}
                          title={showNewPassword ? "隐藏密码" : "显示密码"}
                        >
                          {showNewPassword ? <EyeOffIcon size="sm" /> : <EyeIcon size="sm" />}
                        </button>
                      </div>
                    </Field>

                    <div className="orbit-settings-form-actions">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={
                          savingPassword || !currentPassword || newPassword.length < 8
                        }
                        loading={savingPassword}
                      >
                        更新密码
                      </Button>
                    </div>
                  </Stack>
                </form>
              </Section>
            </>
          ) : null}

          {activeTab === "ai" ? <AiProvidersSettingsPanel /> : null}

          {activeTab === "companion" ? <CompanionSettingsPanel /> : null}

          {activeTab === "space" ? <SpaceSettingsPanel /> : null}

          {activeTab === "integrations" ? <FeishuIntegrationPanel /> : null}

          {activeTab === "notifications" ? <NotificationsSettingsPanel /> : null}

          {activeTab === "api-tokens" ? <ApiTokenSettingsPanel /> : null}
        </div>
        ) : null}
      </div>
    </Container>
  );
}
