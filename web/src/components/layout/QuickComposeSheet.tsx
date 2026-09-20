import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { BottomSheet } from "./BottomSheet";
import { VoiceInputButton } from "../VoiceInputButton";
import { VoiceNoteRecordButton } from "../VoiceNoteRecordButton";
import { MediaAttachmentsBar, type MediaAttachmentItem } from "../MediaAttachmentsBar";
import { GalleryIcon, MomentIcon, LetterIcon, ExpandIcon, HashIcon } from "../OrbitIcons";
import { createEntry, uploadAsset } from "../../lib/api";
import { useToast } from "../../hooks/useToast";
import { useMomentTags } from "../../hooks/useMomentTags";
import { TagManageModal } from "../moment/TagManageModal";
import { useLayer } from "../../hooks/useLayer";
import { marked } from "marked";
import { combineHtmlAndAttachments } from "../../lib/content";

export interface QuickComposeSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * 发布成功后的去向。由调用方负责关闭本层（原地停驻）或用 replace 换页（跳首页）——
   * 只有调用方知道该落在哪里；本组件自身不做「先关层再跳转」的两次导航。
   */
  onPosted: () => void;
  showLetterOption?: boolean;
}

export function QuickComposeSheet({
  isOpen,
  onClose,
  onPosted,
  showLetterOption = true,
}: QuickComposeSheetProps) {
  const [content, setContent] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<MediaAttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { tags } = useMomentTags();
  // 标签管理是压在本层之上的子层：本层条目仍在栈上，抽屉因此保持渲染与内容不丢。
  const {
    isOpen: tagManageOpen,
    open: openTagManage,
    close: closeTagManage,
  } = useLayer("compose-tags");
  const [showTagPicker, setShowTagPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const navigate = useNavigate();

  const handleToggleTag = (tag: string) => {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  };

  const handleTextAppend = useCallback((speechText: string) => {
    setContent((prev) => (prev ? `${prev} ${speechText}` : speechText));
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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
    if (!trimmed && attachments.length === 0) {
      toast.error("请输入内容或添加照片");
      return;
    }

    setSubmitting(true);
    try {
      const textHtml = trimmed ? (marked.parse(trimmed) as string).trim() : "";
      const finalBody = combineHtmlAndAttachments(textHtml, attachments);

      await createEntry({
        type: "moment",
        body: finalBody,
        tag: selectedTag,
      });

      toast.success("发布成功");
      setContent("");
      setSelectedTag(null);
      setAttachments([]);
      setShowTagPicker(false);
      onPosted();
    } catch (err) {
      console.error("Submit error", err);
      toast.error("发布失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchToLongEditor = () => {
    const textHtml = content.trim() ? (marked.parse(content.trim()) as string).trim() : "";
    const finalBody = combineHtmlAndAttachments(textHtml, attachments);
    // 层内换目标：replace 把本层条目换成编辑器页条目，返回时不再浮出抽屉。
    navigate("/moment/new", {
      replace: true,
      state: {
        initialBody: finalBody || undefined,
        initialTag: selectedTag,
      },
    });
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={showLetterOption ? "新建" : "发动态"}
    >
      <div className="flex flex-col gap-3 h-full flex-1">
        {/* 创作入口导航：仅在底栏全局入口触发时展示分流，动态卡片进入时保持纯粹 */}
        {showLetterOption && (
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 py-2.5 px-3 rounded-xl border border-[var(--color-primary)] bg-[var(--color-surface-raised)] select-none">
              <MomentIcon size="sm" className="text-[var(--color-primary)] shrink-0" />
              <span className="text-xs font-medium text-[var(--color-text-primary)]">发动态</span>
            </div>

            <button
              type="button"
              onClick={() => {
                // 层内换目标：写信页取代本层条目，返回时回到抽屉之下的页面。
                navigate("/letter/new", { replace: true });
              }}
              className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-[var(--color-border-light)] bg-[var(--color-surface)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-raised)] transition-all text-left cursor-pointer group select-none"
            >
              <div className="flex items-center gap-2 min-w-0">
                <LetterIcon size="sm" className="text-[var(--color-text-secondary)] group-hover:text-[var(--color-primary)] shrink-0" />
                <span className="text-xs font-medium text-[var(--color-text-primary)]">写信</span>
              </div>
              <span className="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)] transition-transform group-hover:translate-x-0.5 ml-1 shrink-0">
                →
              </span>
            </button>
          </div>
        )}

        {/* 输入框 */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记录当下的想法..."
          rows={4}
          className="w-full p-3 rounded-xl bg-[var(--color-bg)] border border-[var(--color-border-light)] text-[var(--color-text-primary)] text-sm font-sans leading-relaxed resize-none focus:outline-none focus:border-[var(--color-border)] focus:ring-1 focus:ring-[var(--color-border)] transition-all flex-1 min-h-[110px]"
        />

        {/* 媒体预览栏 */}
        {attachments.length > 0 && (
          <div className="bg-[var(--color-bg)] p-2 rounded-xl border border-[var(--color-border-light)]">
            <MediaAttachmentsBar
              attachments={attachments}
              onRemove={handleRemoveAttachment}
              onUpdateAlt={() => {}}
              onUpdateTranscript={handleUpdateTranscript}
            />
          </div>
        )}

        {/* 单标签选择（按需展开；未展开且已选标签时显示轻量便签） */}
        {showTagPicker ? (
          <div className="flex items-center gap-1.5 flex-wrap py-1">
            {tags.map((tag) => {
              const isSelected = selectedTag === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => handleToggleTag(tag.id)}
                  className={[
                    "text-xs px-2.5 py-0.5 rounded-full transition-all cursor-pointer select-none border",
                    isSelected
                      ? "bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] border-[var(--color-border)] font-medium"
                      : "bg-transparent text-[var(--color-text-muted)] border-transparent hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]",
                  ].join(" ")}
                >
                  #{tag.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={openTagManage}
              className="text-xs px-1.5 py-0.5 rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-all cursor-pointer select-none"
              title="管理标签"
              aria-label="管理标签"
            >
              +
            </button>
          </div>
        ) : selectedTag ? (
          <div className="flex items-center py-0.5">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-[var(--color-surface-raised)] text-[var(--color-text-primary)] border border-[var(--color-border-light)] font-medium">
              <span
                role="button"
                tabIndex={0}
                onClick={() => setShowTagPicker(true)}
                className="cursor-pointer"
                title="点击切换标签"
              >
                #{tags.find((t) => t.id === selectedTag)?.name ?? selectedTag}
              </span>
              <button
                type="button"
                onClick={() => setSelectedTag(null)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ml-0.5 cursor-pointer leading-none"
                title="清除标签"
                aria-label="清除标签"
              >
                ×
              </button>
            </span>
          </div>
        ) : null}

        {/* 底部工具栏 */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-light)] mt-auto">
          <div className="flex items-center gap-1.5">
            {/* 隐藏文件输入 */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={handleFileChange}
            />
            {/* 照片按钮 */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="添加照片"
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            >
              <GalleryIcon size="md" />
            </button>

            {/* 录音随想（音频附件）按钮 */}
            <VoiceNoteRecordButton
              compact
              onUploadStateChange={setUploading}
              onVoiceNoteCreated={(res) => {
                const newItem: MediaAttachmentItem = {
                  id: `audio_${Date.now()}`,
                  url: res.url,
                  mimeType: res.mimeType || "audio/webm",
                  duration: res.duration,
                  transcript: res.transcript,
                };
                setAttachments((prev) => [...prev, newItem]);
              }}
            />

            {/* 语音转文字按钮 */}
            <VoiceInputButton
              compact
              onTextUpdate={handleTextAppend}
              title="语音转文字"
            />

            {/* 标签切换按钮 */}
            <button
              type="button"
              onClick={() => setShowTagPicker((prev) => !prev)}
              title={selectedTag ? "修改标签" : "添加标签"}
              aria-label={selectedTag ? "修改标签" : "添加标签"}
              aria-expanded={showTagPicker}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                selectedTag || showTagPicker
                  ? "text-[var(--color-text-primary)] bg-[var(--color-surface-raised)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              <HashIcon size="sm" />
            </button>

            {uploading && (
              <span className="text-xs text-[var(--color-text-muted)] font-mono animate-pulse">
                上传中...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSwitchToLongEditor}
              title="切换至完整编辑"
              aria-label="切换至完整编辑"
              className="p-2 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            >
              <ExpandIcon size="sm" />
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || uploading}
              className="px-4 py-1.5 rounded-full bg-[var(--color-text-primary)] text-[var(--color-surface)] text-xs font-medium shadow-xs active:scale-95 transition-[transform,opacity,background-color] duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "发布中…" : "发布"}
            </button>
          </div>
        </div>
      </div>

      <TagManageModal
        isOpen={tagManageOpen}
        onClose={closeTagManage}
        onTagCreated={(newId) => setSelectedTag(newId)}
      />
    </BottomSheet>
  );
}
