import { useEffect, useState } from "react";
import {
  computeDaysTogetherFromIso,
  formatAnniversaryCn,
  getApiErrorMessage,
  shouldToastApiError,
  updateSpace,
} from "../lib/api";
import { useSpace } from "../contexts/spaceContext";
import { useToast } from "../hooks/useToast";
import { DatePicker } from "./DatePicker";
import { Button, Input, Field, Stack, Card, Section } from "./ui";

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
          设置起始日与侧栏展示文案，双方共用。
        </p>
      </header>

      {loading && !profile ? (
        <p className="orbit-muted orbit-settings-loading">加载中…</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          <Section title="起始日">
            <Stack gap="md">
              {hasAnniversary && previewDays != null && previewDays > 0 ? (
                <Card className="orbit-space-preview orbit-settings-space-preview" aria-live="polite">
                  <p className="orbit-space-preview-days">
                    在一起第 {previewDays.toLocaleString("zh-CN")} 天
                  </p>
                  <p className="orbit-space-preview-sub orbit-muted">
                    自 {formatAnniversaryCn(anniversaryDate)} 起
                  </p>
                </Card>
              ) : null}
              <Field
                label="开始日期"
                htmlFor="settings-space-anniversary"
                hint="选你们开始在一起的那一天。留空则不在侧栏显示天数。"
              >
                <DatePicker
                  id="settings-space-anniversary"
                  value={anniversaryDate}
                  onChange={(value) => {
                    setAnniversaryDate(value);
                    setDirty(true);
                  }}
                  allowClear
                  className="orbit-settings-input-date"
                  placeholder="选择起始日"
                  aria-label="选择起始日"
                />
              </Field>
            </Stack>
          </Section>

          <Section title="侧栏展示">
            <Field
              label="一句话"
              htmlFor="settings-space-slogan"
              hint="未设置纪念日时，侧栏显示这句话。"
            >
              <Input
                id="settings-space-slogan"
                value={slogan}
                maxLength={80}
                placeholder="两个人的时间轨道"
                onChange={(event) => {
                  setSlogan(event.target.value);
                  setDirty(true);
                }}
              />
            </Field>
          </Section>

          <div className="orbit-settings-actions">
            {dirty ? (
              <p className="orbit-settings-actions-hint orbit-muted">有未保存的更改</p>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !dirty}
              loading={saving}
            >
              保存空间档案
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
