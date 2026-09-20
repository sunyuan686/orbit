import { useState, useEffect } from "react";
import { Modal } from "./ui/Modal";
import { Button, Textarea } from "./ui";
import { updateAccountAbout, type SpaceAuthor } from "../lib/api";
import { useToast } from "../hooks/useToast";

export interface UserAboutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  author: SpaceAuthor | null;
  onUpdated?: () => void;
}

export function UserAboutSheet({
  isOpen,
  onClose,
  author,
  onUpdated,
}: UserAboutSheetProps) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [aboutText, setAboutText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (author) {
      setAboutText(author.about ?? "");
      setIsEditing(false);
    }
  }, [author, isOpen]);

  if (!author) return null;

  const birthdayLabel =
    author.birthdaySolarMonth && author.birthdaySolarDay
      ? `${String(author.birthdaySolarMonth).padStart(2, "0")}月${String(author.birthdaySolarDay).padStart(2, "0")}日`
      : null;

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      await updateAccountAbout(aboutText.trim() || null, author!.id);
      setIsEditing(false);
      toast.success("档案已更新");
      onUpdated?.();
    } catch {
      toast.error("更新失败，请稍后重试");
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
      title={`关于${author.name}`}
      subtitle={birthdayLabel ?? undefined}
      maxWidth="26rem"
      footer={
        isEditing ? (
          <div className="flex justify-end gap-2 w-full">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setAboutText(author.about ?? "");
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
        ) : author.about ? (
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
            value={aboutText}
            onChange={(e) => setAboutText(e.target.value)}
            rows={7}
            placeholder="写下关于TA的尺码、口味偏好、避雷忌口或相处小习惯..."
            className="w-full leading-relaxed"
            autoFocus
          />
        </div>
      ) : (
        <div className="space-y-3 py-1">
          {author.about ? (
            <div className="font-sans text-[15px] leading-[1.72] text-[var(--color-text-primary)] whitespace-pre-wrap selection:bg-[var(--color-accent-light)]">
              {author.about}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-[var(--color-text-muted)] space-y-3">
              <p>还没有记录关于{author.name}的喜好与习惯。</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                记录第一条习惯
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
