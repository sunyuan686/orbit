import { useEffect, useState } from "react";
import {
  getApiErrorMessage,
  shouldToastApiError,
  updateSpace,
} from "../lib/api";
import { useSpace } from "../contexts/spaceContext";
import { useToast } from "../hooks/useToast";
import { DatePicker } from "./DatePicker";
import { Button, Textarea, Field, Section } from "./ui";

export function SpaceSettingsPanel() {
  const toast = useToast();
  const { profile, loading, setProfile } = useSpace();
  const [anniversaryDate, setAnniversaryDate] = useState("");
  const [rules, setRules] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setAnniversaryDate(profile.anniversaryDate ?? "");
    setRules(profile.rules ?? "");
    setDirty(false);
  }, [profile]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateSpace({
        anniversaryDate: anniversaryDate || null,
        rules: rules.trim() || null,
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

  return (
    <>
      <header className="orbit-settings-panel-header">
        <h2 className="orbit-settings-panel-title">空间档案</h2>
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
            <Field htmlFor="settings-space-anniversary">
              <DatePicker
                id="settings-space-anniversary"
                value={anniversaryDate}
                onChange={(value) => {
                  setAnniversaryDate(value);
                  setDirty(true);
                }}
                allowClear
                className="orbit-settings-control"
                placeholder="选择起始日"
                aria-label="选择起始日"
              />
            </Field>
          </Section>


          <Section title="约定">
            <Field
              htmlFor="settings-space-rules"
            >
              <Textarea
                id="settings-space-rules"
                value={rules}
                rows={8}
                placeholder="写下属于两个人的约定，例如：不可以冷暴力、吵架不过夜..."
                aria-label="约定"
                onChange={(event) => {
                  setRules(event.target.value);
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
              保存
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
