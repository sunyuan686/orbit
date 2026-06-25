import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { useTheme, type Theme } from "../lib/useTheme";
import { useToast } from "../lib/useToast";

const THEME_OPTIONS: { id: Theme; label: string }[] = [
  { id: "light", label: "浅色" },
  { id: "dark", label: "深色" },
  { id: "system", label: "跟随系统" },
];

export function SettingsPage() {
  const toast = useToast();
  const { theme, setTheme } = useTheme();
  const { settings, loading, setSettings } = useAppSettings();
  const { data: session, refetch: refetchSession } = authClient.useSession();

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
        callbackURL: "/settings",
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
    <div className="orbit-content" data-page="settings">
      <header className="mb-8">
        <h1 className="orbit-page-title">设置</h1>
        <p className="orbit-muted mt-2 text-sm">
          外观偏好与个人账号。纪念日在
          {" "}
          <Link to="/space" className="orbit-text-link">
            我们的空间
          </Link>
          {" "}
          管理。
        </p>
      </header>

      <div className="orbit-settings-stack max-w-lg">
        <section className="orbit-settings-section" aria-labelledby="settings-appearance">
          <h2 id="settings-appearance" className="orbit-settings-heading">
            外观
          </h2>

          <div className="orbit-form-row">
            <span className="orbit-form-label">明暗模式</span>
            <div className="orbit-settings-choices" role="group" aria-label="明暗模式">
              {THEME_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`orbit-settings-choice${theme === option.id ? " orbit-settings-choice--active" : ""}`}
                  onClick={() => setTheme(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="orbit-muted text-xs mt-1.5">仅保存在本设备，不影响对方。</p>
          </div>

          <div className="orbit-form-row mt-6">
            <span className="orbit-form-label">主题色</span>
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
            <p className="orbit-muted text-xs mt-1.5">
              影响按钮与强调色，双方共用。
            </p>
          </div>

          <div className="mt-6">
            <button
              type="button"
              className="orbit-btn orbit-btn-primary"
              disabled={savingAccent || !accentDirty || loading}
              onClick={() => void handleSaveAccent()}
            >
              {savingAccent ? "保存中…" : "保存外观"}
            </button>
          </div>
        </section>

        <section className="orbit-settings-section" aria-labelledby="settings-account">
          <h2 id="settings-account" className="orbit-settings-heading">
            账号
          </h2>

          <div className="orbit-form-row">
            <span className="orbit-form-label">身份</span>
            <p className="text-sm">{session?.user?.name ?? "—"}</p>
            <p className="orbit-muted text-xs mt-1">注册时选定，用于内容署名。</p>
          </div>

          <form className="orbit-form-row mt-6" onSubmit={(e) => void handleUpdateEmail(e)}>
            <label htmlFor="settings-email" className="orbit-form-label">
              邮箱
            </label>
            <input
              id="settings-email"
              type="email"
              value={email}
              autoComplete="email"
              className="orbit-input w-full"
              onChange={(event) => {
                setEmail(event.target.value);
                setEmailDirty(event.target.value.trim() !== (session?.user?.email ?? ""));
              }}
            />
            <button
              type="submit"
              className="orbit-btn mt-3"
              disabled={savingEmail || !emailDirty}
            >
              {savingEmail ? "更新中…" : "更新邮箱"}
            </button>
          </form>

          <form className="orbit-form-row mt-6" onSubmit={(e) => void handleUpdatePassword(e)}>
            <span className="orbit-form-label">密码</span>
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
              placeholder="新密码（至少 8 位）"
              className="orbit-input w-full mt-2"
              minLength={8}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <button
              type="submit"
              className="orbit-btn mt-3"
              disabled={
                savingPassword || !currentPassword || newPassword.length < 8
              }
            >
              {savingPassword ? "更新中…" : "更新密码"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
