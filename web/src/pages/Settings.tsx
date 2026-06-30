import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  authClient,
  getApiErrorMessage,
  shouldToastApiError,
  updateAppSettings,
  type AccentPreset,
} from "../lib/api";
import { ACCENT_PRESET_LIST, applyAccentPreset } from "../lib/accent";
import { useAppSettings } from "../lib/appSettingsContext";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import { AiProvidersSettingsPanel } from "../components/AiProvidersSettingsPanel";
import { AiIcon, ChevronLeftIcon, ChevronRightIcon, PaletteIcon, TimelineIcon, UserIcon } from "../components/OrbitIcons";
import { SpaceSettingsPanel } from "../components/SpaceSettingsPanel";
import { useMaxWidthMd } from "../lib/useBreakpoint";

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
        description: "供应商、模型与 API Key",
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

  useEffect(() => {
    setPageTitle("设置");
  }, []);

  useEffect(() => {
    if (!settings) return;
    setAccentPreset(settings.accentPreset);
    setAccentDirty(false);
  }, [settings]);

  useEffect(() => {
    if (!session?.user?.email) return;
    setEmail(session.user.email);
    setEmailDirty(false);
  }, [session?.user?.email]);

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
                  <SettingsField
                    label="主题色"
                    hint="选择强调色，影响按钮与链接样式。"
                    stacked
                  >
                    <div
                      className="orbit-settings-accent-grid"
                      role="radiogroup"
                      aria-label="主题色"
                    >
                      {ACCENT_PRESET_LIST.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          role="radio"
                          aria-checked={accentPreset === preset.id}
                          className={`orbit-settings-accent-option${accentPreset === preset.id ? " orbit-settings-accent-option--active" : ""}`}
                          onClick={() => handleAccentSelect(preset.id)}
                        >
                          <span
                            className={`orbit-accent-swatch orbit-accent-swatch--${preset.id}${accentPreset === preset.id ? " orbit-accent-swatch--active" : ""}`}
                            aria-hidden="true"
                          />
                          <span className="orbit-settings-accent-label">
                            {preset.label}
                          </span>
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
                    <div className="orbit-settings-readonly-card">
                      <p className="orbit-settings-readonly-value">
                        {session?.user?.name ?? "—"}
                      </p>
                    </div>
                  </SettingsField>
                </div>
              </SettingsSection>

              <SettingsSection title="登录方式">
                <div className="orbit-settings-fields">
                  <div className="orbit-settings-field orbit-settings-field--editable orbit-settings-field--stacked">
                    <form
                      className="orbit-settings-stacked-form"
                      onSubmit={(e) => void handleUpdateEmail(e)}
                    >
                      <div className="orbit-settings-field-copy">
                        <label htmlFor="settings-email" className="orbit-settings-field-label">
                          邮箱
                        </label>
                        <p className="orbit-settings-field-hint">用于登录与账户通知。</p>
                      </div>
                      <div className="orbit-settings-field-control orbit-settings-field-control--block">
                        <div className="orbit-settings-inline-form">
                          <input
                            id="settings-email"
                            type="email"
                            value={email}
                            autoComplete="email"
                            className="orbit-input orbit-settings-input-block"
                            onChange={(event) => {
                              setEmail(event.target.value);
                              setEmailDirty(
                                event.target.value.trim() !== (session?.user?.email ?? "")
                              );
                            }}
                          />
                          <button
                            type="submit"
                            className="orbit-btn orbit-btn-sm"
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
                  <div className="orbit-settings-field orbit-settings-field--editable orbit-settings-field--stacked">
                    <form
                      className="orbit-settings-stacked-form"
                      onSubmit={(e) => void handleUpdatePassword(e)}
                    >
                      <div className="orbit-settings-field-copy">
                        <label htmlFor="settings-current-password" className="orbit-settings-field-label">
                          密码
                        </label>
                        <p className="orbit-settings-field-hint">新密码至少 8 位。</p>
                      </div>
                      <div className="orbit-settings-field-control orbit-settings-field-control--block">
                        <div className="orbit-settings-password-fields">
                          <input
                            id="settings-current-password"
                            type="password"
                            value={currentPassword}
                            autoComplete="current-password"
                            placeholder="当前密码"
                            className="orbit-input orbit-settings-input-block"
                            onChange={(event) => setCurrentPassword(event.target.value)}
                          />
                          <input
                            id="settings-new-password"
                            type="password"
                            value={newPassword}
                            autoComplete="new-password"
                            placeholder="新密码"
                            className="orbit-input orbit-settings-input-block"
                            minLength={8}
                            onChange={(event) => setNewPassword(event.target.value)}
                          />
                          <button
                            type="submit"
                            className="orbit-btn orbit-btn-sm orbit-settings-form-submit"
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

          {activeTab === "ai" ? <AiProvidersSettingsPanel /> : null}

          {activeTab === "space" ? <SpaceSettingsPanel /> : null}
        </div>
        ) : null}
      </div>
    </div>
  );
}
