import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../lib/queryKeys";
import {
  authClient,
  createInvite,
  fetchActiveInvite,
  fetchSpaceStatus,
  formatDateTime,
  getApiErrorMessage,
  shouldToastApiError,
  uploadAsset,
  type SpaceStatus,
} from "../lib/api";
import {
  PRESET_AVATARS,
  getDefaultAvatar,
  type PresetAvatar,
} from "../lib/presetAvatars";
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
import { usePwaUpdate } from "../hooks/usePwaUpdate";
import { useTheme, type Theme } from "../hooks/useTheme";
import { ApiTokenSettingsPanel } from "../components/ApiTokenSettingsPanel";
import { AiProvidersSettingsPanel } from "../components/AiProvidersSettingsPanel";
import { FeishuIntegrationPanel } from "../components/FeishuIntegrationPanel";
import { NotificationsSettingsPanel } from "../components/NotificationsSettingsPanel";
import { AboutSettingsPanel } from "../components/AboutSettingsPanel";
import {
  AiIcon,
  BellIcon,
  CheckIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  KeyIcon,
  MemoriesIcon,
  MessageIcon,
  MonitorIcon,
  MoonIcon,
  PaletteIcon,
  SunIcon,
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
  | "api-tokens"
  | "about";

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
        description: "起始日与约定",
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
  {
    id: "system",
    label: "系统",
    tabs: [
      {
        id: "about",
        label: "关于",
        description: "版本信息与客户端安装",
        icon: (props) => <InfoIcon {...props} />,
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
    value === "api-tokens" ||
    value === "about"
  );
}

/** Legacy `tab=account` → 个人资料 */
function resolveSettingsTab(value: string | null): SettingsTab | null {
  if (value === "account") return "profile";
  return isSettingsTab(value) ? value : null;
}

const APPEARANCE_MODES: { id: Theme; label: string; icon: typeof SunIcon }[] = [
  { id: "light", label: "浅色模式", icon: SunIcon },
  { id: "dark", label: "深色模式", icon: MoonIcon },
  { id: "system", label: "跟随系统", icon: MonitorIcon },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const { data: session, refetch: refetchSession } = authClient.useSession();
  const [searchParams, setSearchParams] = useSearchParams();

  const isMobile = useMaxWidthMd();
  const { needRefresh } = usePwaUpdate();
  const tabParam = searchParams.get("tab");
  const resolvedTab = resolveSettingsTab(tabParam);
  const activeTab: SettingsTab = resolvedTab ?? "appearance";
  const showMobileMenu = isMobile && !resolvedTab;
  const showMobileDetail = isMobile && Boolean(resolvedTab);

  const [accentPreset, setAccentPreset] = useState<AccentTheme>(() => getSavedAccentTheme());

  const [signingOut, setSigningOut] = useState(false);

  const [email, setEmail] = useState("");
  const [emailDirty, setEmailDirty] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);


  const [currentPassword, setCurrentPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [displayNameDirty, setDisplayNameDirty] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);

  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

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
    // 两种布局的历史语义不同：
    // - 桌面端左侧导航与右侧面板同屏，切换只是换面板，不该进历史（replace）；
    // - 移动端是「菜单 → 二级面板」的真实层级推进，必须 push，
    //   这样系统返回手势与面板内的返回按钮都能退回菜单，而不是跳过一层离开设置页。
    setSearchParams({ tab }, { replace: !isMobile });
  }

  const [canvasBg, setCanvasBgState] = useState<CanvasBg>(() => getSavedCanvasBg());
  const [grainOpacity, setGrainOpacityState] = useState<number>(() => getSavedGrainOpacity());
  const [fontMode, setFontModeState] = useState<FontMode>(() => getSavedFontMode());
  const [fontSize, setFontSizeState] = useState<ReadingFontSize>(() => getSavedFontSize());

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut({ fetchOptions: { credentials: "include" } });
      toast.success("已退出登录");
      navigate("/login", { replace: true });
    } catch {
      toast.error("退出失败，请稍后重试");
    } finally {
      setSigningOut(false);
    }
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
      const res = await authClient.updateUser({
        name: nextName,
      });
      if (res.error) {
        throw new Error(res.error.message || "更新爱称失败");
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.spaceStatus });
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

  async function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("头像文件大小不能超过 10MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const asset = await uploadAsset(file);
      const res = await authClient.updateUser({
        image: asset.url,
      });
      if (res.error) {
        throw new Error(res.error.message || "更新头像失败");
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.spaceStatus });
      toast.success("头像已更新");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "头像上传失败"));
      }
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    if (uploadingAvatar) return;
    setUploadingAvatar(true);
    try {
      const res = await authClient.updateUser({
        image: null as any,
      });
      if (res.error) {
        throw new Error(res.error.message || "移除头像失败");
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.spaceStatus });
      toast.success("头像已恢复默认");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "移除失败"));
      }
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSelectPresetAvatar(preset: PresetAvatar) {
    if (uploadingAvatar) return;
    if (session?.user?.image === preset.url) return;
    setUploadingAvatar(true);
    try {
      const res = await authClient.updateUser({
        image: preset.url,
      });
      if (res.error) {
        throw new Error(res.error.message || "更新头像失败");
      }
      void queryClient.invalidateQueries({ queryKey: queryKeys.spaceStatus });
      toast.success(`已换上「${preset.label}」手账头像`);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更换头像失败"));
      }
    } finally {
      setUploadingAvatar(false);
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
    if (savingPassword || !currentPassword || !newPassword || !confirmPassword) return;
    if (newPassword.length < 8) {
      toast.error("新密码至少 8 位");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("新密码不能与当前密码相同");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        toast.error(error.message || "密码更新失败，请检查当前密码");
        return;
      }
      await authClient.signOut({ fetchOptions: { credentials: "include" } });
      toast.success("密码已更新，请使用新密码重新登录");
      navigate("/login", { replace: true });
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
                    <span>{tab.label}</span>
                    {tab.id === "about" && needRefresh ? (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] ml-auto shrink-0"
                        title="新版本可用"
                        aria-label="新版本可用"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        ) : null}

        {showMobileMenu ? (
          <>
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
                              <span className="orbit-settings-mobile-row-label flex items-center gap-1.5">
                                <span>{tab.label}</span>
                                {tab.id === "about" && needRefresh ? (
                                  <span
                                    className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] shrink-0"
                                    title="新版本可用"
                                    aria-label="新版本可用"
                                  />
                                ) : null}
                              </span>
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

            <div className="mt-6 mb-6">
              <ul className="orbit-settings-mobile-group">
                <li>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="orbit-settings-mobile-row justify-center font-medium cursor-pointer disabled:opacity-50"
                    style={{ color: "var(--color-danger)" }}
                  >
                    {signingOut ? "退出中…" : "退出登录"}
                  </button>
                </li>
              </ul>
            </div>
          </>
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
              </header>

              {/* 0. 外观模式（深浅色） */}
              <Section title="外观模式">
                <div
                  className="orbit-appearance-segmented"
                  role="radiogroup"
                  aria-label="外观模式"
                >
                  {APPEARANCE_MODES.map((mode) => {
                    const isSelected = theme === mode.id;
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`orbit-appearance-segment-btn${isSelected ? " orbit-appearance-segment-btn--active" : ""}`}
                        onClick={() => {
                          setTheme(mode.id);
                          toast.success(`外观已切换为「${mode.label}」`);
                        }}
                      >
                        <Icon size="sm" />
                        <span>{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* 1. 品牌主题色 */}
              <Section title="主题色">
                <div
                  className="orbit-theme-swatches"
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
                        aria-label={preset.label}
                        className={`orbit-theme-swatch-item${isSelected ? " orbit-theme-swatch-item--active" : ""}`}
                        onClick={() => handleAccentSelect(preset.id)}
                      >
                        <span
                          className="orbit-theme-swatch-circle"
                          style={{ backgroundColor: preset.colorPreview }}
                        >
                          {isSelected && <CheckIcon size="sm" className="orbit-theme-swatch-check" />}
                        </span>
                        <span className="orbit-theme-swatch-label">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* 2. 画布底色 */}
              <Section title="纸张底色">
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
                        <span
                          className="orbit-canvas-card-swatch"
                          style={{ backgroundColor: bg.colorPreview }}
                          aria-hidden="true"
                        />
                        <div className="orbit-canvas-card-info">
                          <span className="orbit-canvas-card-title">{bg.label}</span>
                          <span className="orbit-canvas-card-desc">{bg.desc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* 3. 排版风格 */}
              <Section title="排版风格">
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
                        <span className={`orbit-font-card-title orbit-font-card-title--${mode.id}`}>
                          {mode.label}
                        </span>
                        <span className="orbit-font-card-desc">{mode.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* 4. 阅读字号 */}
              <Section title="阅读字号">
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
              </Section>

              {/* 5. 纸质微颗粒感 */}
              <Section title="纸张微颗粒">
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
              </Section>
            </>
          ) : null}

          {activeTab === "profile" ? (
            <>
              <header className="orbit-settings-panel-header">
                <h2 className="orbit-settings-panel-title">个人资料</h2>
              </header>

              <Section title="头像">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--color-surface-raised)] border border-[var(--color-border)] flex items-center justify-center shrink-0 shadow-xs">
                      <img
                        src={session?.user?.image || getDefaultAvatar(session?.user?.id)}
                        alt={session?.user?.name ?? "头像"}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = getDefaultAvatar(session?.user?.id);
                        }}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Stack direction="row" gap="sm" align="center">
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileSelect}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => avatarInputRef.current?.click()}
                          loading={uploadingAvatar}
                          disabled={uploadingAvatar}
                        >
                          上传照片
                        </Button>
                        {session?.user?.image ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRemoveAvatar()}
                            disabled={uploadingAvatar}
                          >
                            恢复默认
                          </Button>
                        ) : null}
                      </Stack>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-[var(--color-border-light)]">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                      手账插画预设
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {PRESET_AVATARS.map((preset) => {
                        const isSelected =
                          session?.user?.image === preset.url ||
                          (!session?.user?.image && getDefaultAvatar(session?.user?.id) === preset.url);

                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => void handleSelectPresetAvatar(preset)}
                            disabled={uploadingAvatar}
                            className={`group relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl border transition-all cursor-pointer ${
                              isSelected
                                ? "border-[var(--color-accent)] bg-[var(--color-surface-raised)] ring-2 ring-[var(--color-accent)]/20"
                                : "border-[var(--color-border-light)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-raised)]"
                            }`}
                            title={`选择「${preset.label}」`}
                          >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-[var(--color-surface)] border border-[var(--color-border-light)] shrink-0 flex items-center justify-center">
                              <img
                                src={preset.url}
                                alt={preset.label}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <span
                              className={`text-[11px] leading-tight ${
                                isSelected
                                  ? "font-medium text-[var(--color-text-primary)]"
                                  : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                              }`}
                            >
                              {preset.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="爱称">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveDisplayName(e);
                  }}
                >
                  <Field
                    label="内容署名"
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
              </header>

              <Section title="账户邮箱">
                <form
                  className="orbit-settings-form-block"
                  onSubmit={(e) => void handleUpdateEmail(e)}
                >
                  <Field
                    label="登录邮箱"
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

                    <Field
                      label="确认新密码"
                    >
                      <div className="orbit-password-input-wrapper">
                        <Input
                          id="settings-confirm-password"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          autoComplete="new-password"
                          placeholder="再次输入新密码"
                          minLength={8}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                        />
                        <button
                          type="button"
                          className="orbit-password-toggle-btn"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? "隐藏密码" : "显示密码"}
                          title={showConfirmPassword ? "隐藏密码" : "显示密码"}
                        >
                          {showConfirmPassword ? <EyeOffIcon size="sm" /> : <EyeIcon size="sm" />}
                        </button>
                      </div>
                    </Field>

                    <div className="orbit-settings-form-actions">
                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={
                          savingPassword ||
                          !currentPassword ||
                          newPassword.length < 8 ||
                          confirmPassword.length < 8 ||
                          newPassword !== confirmPassword
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
          {activeTab === "about" ? <AboutSettingsPanel /> : null}
        </div>
        ) : null}
      </div>
    </Container>
  );
}
