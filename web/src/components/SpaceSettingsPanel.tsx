import { useEffect, useState, type ReactNode } from "react";
import {
  computeDaysTogetherFromIso,
  formatAnniversaryCn,
  getApiErrorMessage,
  shouldToastApiError,
  updateSpace,
} from "../lib/api";
import { useSpace } from "../lib/spaceContext";
import { useToast } from "../lib/useToast";
import { DatePicker } from "./DatePicker";

function SpaceSettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const headingId = `settings-space-section-${title}`;
  return (
    <section className="orbit-settings-section" aria-labelledby={headingId}>
      <h3 id={headingId} className="orbit-settings-heading">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function SpaceSettingsPanel() {
  const toast = useToast();
  const { profile, loading, setProfile } = useSpace();
  const [anniversaryDate, setAnniversaryDate] = useState("");
  const [slogan, setSlogan] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setAnniversaryDate(profile.anniversaryDate ?? "");
    setSlogan(profile.slogan ?? "");
    setDirty(false);
  }, [profile]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateSpace({
        anniversaryDate: anniversaryDate || null,
        slogan: slogan.trim() || null,
      });
      setProfile(next);
      setDirty(false);
      toast.success("空间档案已保存");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
      }
    } finally {
      setSaving(false);
    }
  }

  const previewDays = anniversaryDate
    ? computeDaysTogetherFromIso(anniversaryDate)
    : null;
  const hasAnniversary = Boolean(anniversaryDate);

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">空间档案</h2>
        <p className="orbit-settings-panel-desc">
          起始日与侧栏展示。
        </p>
      </header>

      {loading && !profile ? (
        <p className="orbit-muted text-sm">加载中…</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <SpaceSettingsSection title="起始日">
            {hasAnniversary && previewDays != null && previewDays > 0 ? (
              <div className="orbit-space-preview orbit-settings-space-preview" aria-live="polite">
                <p className="orbit-space-preview-days">
                  在一起第 {previewDays.toLocaleString("zh-CN")} 天
                </p>
                <p className="orbit-muted text-sm mt-1">
                  自 {formatAnniversaryCn(anniversaryDate)} 起
                </p>
              </div>
            ) : null}
            <div className="orbit-settings-fields">
              <div className="orbit-settings-field orbit-settings-field--stacked orbit-settings-field--editable">
                <div className="orbit-settings-field-copy">
                  <label htmlFor="settings-space-anniversary" className="orbit-settings-field-label">
                    开始日期
                  </label>
                  <p className="orbit-settings-field-hint">
                    选你们开始在一起的那一天。留空则不在侧栏显示天数。
                  </p>
                </div>
                <div className="orbit-settings-field-control orbit-settings-field-control--block">
                  <DatePicker
                    id="settings-space-anniversary"
                    value={anniversaryDate}
                    onChange={(value) => {
                      setAnniversaryDate(value);
                      setDirty(true);
                    }}
                    allowClear
                    className="w-full max-w-xs"
                    placeholder="选择起始日"
                    aria-label="选择起始日"
                  />
                </div>
              </div>
            </div>
          </SpaceSettingsSection>

          <SpaceSettingsSection title="侧栏展示">
            <div className="orbit-settings-fields">
              <div className="orbit-settings-field orbit-settings-field--stacked orbit-settings-field--editable">
                <div className="orbit-settings-field-copy">
                  <label htmlFor="settings-space-slogan" className="orbit-settings-field-label">
                    一句话
                  </label>
                  <p className="orbit-settings-field-hint">
                    未设置纪念日时，侧栏显示这句话。
                  </p>
                </div>
                <div className="orbit-settings-field-control orbit-settings-field-control--block">
                  <input
                    id="settings-space-slogan"
                    type="text"
                    value={slogan}
                    maxLength={80}
                    placeholder="两个人的时间轨道"
                    onChange={(event) => {
                      setSlogan(event.target.value);
                      setDirty(true);
                    }}
                    className="orbit-input w-full"
                  />
                </div>
              </div>
            </div>
          </SpaceSettingsSection>

          <div className="orbit-settings-actions">
            {dirty ? (
              <p className="orbit-settings-actions-hint orbit-muted">有未保存的更改</p>
            ) : null}
            <button
              type="submit"
              className="orbit-btn orbit-btn-primary"
              disabled={saving || !dirty}
            >
              {saving ? "保存中…" : "保存修改"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
