import { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Button, Textarea } from "./ui";
import { updateSpace } from "../lib/api";
import { useSpace } from "../contexts/spaceContext";
import { useToast } from "../hooks/useToast";

export interface SpaceCovenantSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SpaceCovenantSheet({ isOpen, onClose }: SpaceCovenantSheetProps) {
  const toast = useToast();
  const { profile, setProfile } = useSpace();
  const [isEditing, setIsEditing] = useState(false);
  const [rules, setRules] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setRules(profile.rules ?? "");
      setIsEditing(false);
    }
  }, [profile, isOpen]);

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateSpace({
        rules: rules.trim() || null,
      });
      setProfile(next);
      setIsEditing(false);
      toast.success("约定已保存");
    } catch {
      toast.error("保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setIsEditing(false);
        onClose();
      }}
      title="我们的约定"
      maxWidth="28rem"
      footer={
        isEditing ? (
          <div className="flex justify-end gap-2 w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setRules(profile?.rules ?? "");
                setIsEditing(false);
              }}
              disabled={saving}
            >
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSave}
              loading={saving}
            >
              保存
            </Button>
          </div>
        ) : profile?.rules ? (
          <div className="flex justify-end w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              编辑
            </Button>
          </div>
        ) : undefined
      }
    >
      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={8}
            placeholder="写下属于两个人的约定..."
            className="w-full leading-relaxed"
            autoFocus
          />
        </div>
      ) : (
        <div className="space-y-3 py-1">
          {profile?.rules ? (
            <div className="font-sans text-[15px] leading-[1.72] text-[var(--color-text-primary)] whitespace-pre-wrap selection:bg-[var(--color-accent-light)]">
              {profile.rules}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[var(--color-text-muted)] space-y-3">
              <p>还没有写下属于两个人的约定。</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                写下第一条约定
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
