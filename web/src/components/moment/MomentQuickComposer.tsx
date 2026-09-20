import { useState, useRef } from "react";
import { createEntry, uploadAsset } from "../../lib/api";
import { useToast } from "../../hooks/useToast";
import { useMomentTags } from "../../hooks/useMomentTags";
import { MediaAttachmentsBar, type MediaAttachmentItem } from "../MediaAttachmentsBar";
import { GalleryIcon } from "../OrbitIcons";
import { marked } from "marked";
import { combineHtmlAndAttachments } from "../../lib/content";

export interface MomentQuickComposerProps {
  onSuccess?: () => void;
  className?: string;
}

export function MomentQuickComposer({ onSuccess, className = "" }: MomentQuickComposerProps) {
  const [content, setContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<MediaAttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const { tags } = useMomentTags();

  const isExpanded = isFocused || content.trim().length > 0 || attachments.length > 0;
  const canSubmit = content.trim().length > 0 || attachments.length > 0;

  const handleToggleTag = (tagId: string) => {
    setSelectedTag((prev) => (prev === tagId ? null : tagId));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);

    for (const file of files) {
      try {
        const res = await uploadAsset(file);
        setAttachments((prev) => [
          ...prev,
          {
            id: res.filename || res.url,
            url: res.url,
            mimeType: res.mimeType,
            width: res.width,
            height: res.height,
          },
        ]);
      } catch (err) {
        console.error("Upload error", err);
        toast.error("图片上传失败");
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleUpdateTranscript = (id: string, transcript: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, transcript } : a))
    );
  };

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed && attachments.length === 0) return;

    setSubmitting(true);
    try {
      const textHtml = trimmed ? (marked.parse(trimmed) as string).trim() : "";
      const finalBody = combineHtmlAndAttachments(textHtml, attachments);

      await createEntry({
        type: "moment",
        body: finalBody,
        tag: selectedTag,
      });

      toast.success("动态已记录");
      setContent("");
      setSelectedTag(null);
      setAttachments([]);
      setIsFocused(false);
      onSuccess?.();
    } catch (err) {
      console.error("Failed to post moment", err);
      toast.error("发布失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (canSubmit && !submitting) {
        handleSubmit();
      }
    }
  };

  return (
    <div
      className={`w-full bg-[var(--color-surface)] border border-[var(--color-border-light)] focus-within:border-[var(--color-border)] rounded-xl p-3.5 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* 真实文本输入框 */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          if (!content.trim() && attachments.length === 0) {
            setIsFocused(false);
          }
        }}
        onKeyDown={handleKeyDown}
        placeholder="记录当下的想法或生活小切片…"
        rows={isExpanded ? 3 : 1}
        className="w-full bg-transparent border-0 resize-none text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none leading-relaxed"
      />

      {/* 媒体缩略图预览栏 */}
      {attachments.length > 0 && (
        <div className="mt-2 pt-2 border-t border-[var(--color-border-light)]">
          <MediaAttachmentsBar
            attachments={attachments}
            onRemove={handleRemoveAttachment}
            onUpdateAlt={(id, alt) => {
              setAttachments((prev) =>
                prev.map((a) => (a.id === id ? { ...a, alt } : a))
              );
            }}
            onUpdateTranscript={handleUpdateTranscript}
          />
        </div>
      )}

      {/* 展开态操作栏 */}
      {isExpanded && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--color-border-light)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* 照片上传按钮 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface-raised)]/80 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer disabled:opacity-50"
              title="添加照片"
            >
              <GalleryIcon size="sm" />
              <span>{uploading ? "上传中…" : "照片"}</span>
            </button>

            {/* 标签单选 */}
            {tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {tags.map((t) => {
                  const isSelected = selectedTag === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleToggleTag(t.id)}
                      className={`px-2 py-0.5 text-xs rounded-md border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-[var(--color-text-primary)] text-[var(--color-surface)] border-[var(--color-text-primary)] font-medium"
                          : "bg-transparent text-[var(--color-text-muted)] border-[var(--color-border-light)] hover:border-[var(--color-border)] hover:text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:inline text-[11px] text-[var(--color-text-muted)] font-mono">
              ⌘ + Enter
            </span>
            <button
              type="button"
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
              className="orbit-btn orbit-btn-sm orbit-btn-primary"
            >
              {submitting ? "发布中…" : "发布"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
