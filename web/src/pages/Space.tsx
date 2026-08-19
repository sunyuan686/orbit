import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  computeDaysTogetherFromIso,
  formatAnniversaryCn,
  getApiErrorMessage,
  shouldToastApiError,
  updateSpace,
} from "../lib/api";
import { useSpace } from "../contexts/spaceContext";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../hooks/useToast";

export function SpacePage() {
  const toast = useToast();
  const { profile, loading, setProfile } = useSpace();
  const [anniversaryDate, setAnniversaryDate] = useState("");
  const [slogan, setSlogan] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setPageTitle("我们的空间");
  }, []);

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
    <div className="orbit-content" data-page="space">
      <header className="mb-8">
        <h1 className="orbit-page-title">我们的空间</h1>
        <p className="orbit-muted mt-2 text-sm">
          记录你们在一起的日子。侧栏会展示相处天数。
        </p>
      </header>

      {loading && !profile ? (
        <p className="orbit-muted text-sm">加载中…</p>
      ) : (
        <form
          className="orbit-space-form max-w-lg"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSave();
          }}
        >
          {hasAnniversary && previewDays != null && previewDays > 0 && (
            <div className="orbit-space-preview mb-6" aria-live="polite">
              <p className="orbit-space-preview-days">
                在一起第 {previewDays.toLocaleString("zh-CN")} 天
              </p>
              <p className="orbit-muted text-sm mt-1">
                自 {formatAnniversaryCn(anniversaryDate)} 起
              </p>
            </div>
          )}

          <div className="orbit-form-row">
            <label htmlFor="space-anniversary" className="orbit-form-label">
              纪念日
            </label>
            <input
              id="space-anniversary"
              type="date"
              value={anniversaryDate}
              onChange={(event) => {
                setAnniversaryDate(event.target.value);
                setDirty(true);
              }}
              className="orbit-input-date"
            />
            <p className="orbit-muted text-xs mt-1.5">
              选你们开始在一起的那一天。留空则不在侧栏显示天数。
            </p>
          </div>

          <div className="orbit-form-row mt-6">
            <label htmlFor="space-slogan" className="orbit-form-label">
              一句话
            </label>
            <input
              id="space-slogan"
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
            <p className="orbit-muted text-xs mt-1.5">
              未设置纪念日时，侧栏显示这句话。
            </p>
          </div>

          <div className="mt-8 flex items-center gap-3">
            <button
              type="submit"
              className="orbit-btn orbit-btn-primary"
              disabled={saving || !dirty}
            >
              {saving ? "保存中…" : "保存修改"}
            </button>
            <Link to="/diary" className="orbit-text-link text-sm">
              返回日记
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
