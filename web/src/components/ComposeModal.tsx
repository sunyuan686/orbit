import React, { useState, useRef, useEffect, useCallback } from "react";
import { TiptapEditor, type TiptapEditorHandle } from "./TiptapEditor";
import { EditorFullscreenOverlay } from "./EditorFullscreenOverlay";
import { MediaAttachmentsBar, type MediaAttachmentItem } from "./MediaAttachmentsBar";
import { VoiceInputButton } from "./VoiceInputButton";
import { VoiceNoteRecordButton } from "./VoiceNoteRecordButton";
import { uploadAsset } from "../lib/api";
import type { EditorHandoffState } from "../lib/editor-handoff";

export type ComposeFormat = "note" | "appreciation" | "link" | "quote";
export type ComposeMode = "note" | "article";

export interface AppreciationTag {
  id: string;
  icon: string;
  label: string;
}

export const APPRECIATION_TAGS: AppreciationTag[] = [
  { id: "drink", icon: "☕️", label: "暖心饮品" },
  { id: "food", icon: "🍱", label: "美味餐食" },
  { id: "care", icon: "💪", label: "贴心照顾" },
  { id: "listen", icon: "👂", label: "倾听安慰" },
  { id: "surprise", icon: "🎁", label: "惊喜礼物" },
  { id: "tacit", icon: "✨", label: "默契配合" },
];

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (data: {
    format: ComposeFormat;
    mode: ComposeMode;
    title: string;
    body: string;
    attachments: MediaAttachmentItem[];
    linkUrl?: string;
    appreciationTag?: string | null;
  }) => Promise<void>;
  defaultFormat?: ComposeFormat;
  defaultMode?: ComposeMode;
  entryId?: string;
}

export function ComposeModal({
  isOpen,
  onClose,
  onSubmit,
  defaultFormat = "note",
  defaultMode = "note",
  entryId,
}: ComposeModalProps) {
  const [format, setFormat] = useState<ComposeFormat>(defaultFormat);
  const [title, setTitle] = useState("");
  const [showTitle, setShowTitle] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const bodyRef = useRef(body);
  const [attachments, setAttachments] = useState<MediaAttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenHandoff, setFullscreenHandoff] = useState<EditorHandoffState | null>(null);
  const [lastComposeMode, setLastComposeMode] = useState<ComposeMode>(defaultMode);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<TiptapEditorHandle>(null);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    if (isOpen) {
      setFormat(defaultFormat);
      setLastComposeMode(defaultMode);
      setFullscreenOpen(false);
      setFullscreenHandoff(null);
      setSelectedTagId(null);
      setShowTitle(Boolean(title && title.trim().length > 0));
    }
  }, [isOpen, defaultFormat, defaultMode, title]);

  const applyFullscreenClose = useCallback((detail: {
    html: string;
    title: string;
    selection: EditorHandoffState["selection"];
    json: EditorHandoffState["json"];
  }) => {
    bodyRef.current = detail.html;
    setBody(detail.html);
    setTitle(detail.title);
    if (detail.title && detail.title.trim().length > 0) {
      setShowTitle(true);
    }
    setLastComposeMode("article");
    setFullscreenOpen(false);
    setFullscreenHandoff(null);
    requestAnimationFrame(() => {
      editorRef.current?.setEditorState(detail.json, detail.selection);
      editorRef.current?.focusSelection(detail.selection);
    });
  }, []);

  const handleOpenFullscreen = useCallback(() => {
    if (format !== "note" && format !== "appreciation") return;
    const state = editorRef.current?.getEditorState();
    if (!state) return;
    setFullscreenHandoff(state);
    setFullscreenOpen(true);
  }, [format]);

  const handleSubmit = useCallback(async (bodyOverride?: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      let finalBody = bodyOverride ?? bodyRef.current;
      if (format === "appreciation" && selectedTagId) {
        const tag = APPRECIATION_TAGS.find((t) => t.id === selectedTagId);
        if (tag) {
          const badgeHtml = `<p class="orbit-appreciation-badge-header"><span class="orbit-appreciation-badge">${tag.icon} ${tag.label}</span></p>`;
          finalBody = badgeHtml + finalBody;
        }
      }
      if (attachments.length > 0) {
        const imgsHtml = attachments
          .map((a) => `<img src="${a.url}"${a.alt ? ` alt="${a.alt}"` : ""} class="orbit-prose-img" />`)
          .join("");
        finalBody += imgsHtml;
      }
      await onSubmit?.({
        format,
        mode: lastComposeMode,
        title: title.trim(),
        body: finalBody,
        attachments,
        linkUrl: linkUrl.trim(),
        appreciationTag: selectedTagId,
      });
      onClose();
    } catch (err) {
      console.error("Submit failed", err);
    } finally {
      setSubmitting(false);
    }
  }, [
    attachments,
    format,
    lastComposeMode,
    linkUrl,
    onClose,
    onSubmit,
    selectedTagId,
    submitting,
    title,
  ]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleUpdateAlt = useCallback((id: string, alt: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, alt } : a))
    );
  }, []);

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const res = await uploadAsset(file, entryId);
        const newItem: MediaAttachmentItem = {
          id: `media_${Date.now()}_${i}`,
          url: res.url,
          mimeType: res.mimeType,
          width: res.width,
          height: res.height,
          duration: res.duration,
          transcript: res.transcript,
        };
        setAttachments((prev) => [...prev, newItem]);
      }
    } catch (err) {
      console.error("Failed to upload media attachment", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [entryId]);

  if (!isOpen) return null;

  return (
    <>
      <div className="orbit-compose-overlay">
        <div className="orbit-compose-modal">
          <div className="orbit-compose-header">
            <button type="button" onClick={onClose} className="orbit-compose-cancel-btn">
              取消
            </button>

            <div className="orbit-compose-segmented">
              <button
                type="button"
                className={`orbit-compose-segment-btn ${format === "note" ? "active" : ""}`}
                onClick={() => setFormat("note")}
              >
                随想
              </button>
              <button
                type="button"
                className={`orbit-compose-segment-btn ${format === "appreciation" ? "active" : ""}`}
                onClick={() => setFormat("appreciation")}
              >
                感谢
              </button>
              <button
                type="button"
                className={`orbit-compose-segment-btn ${format === "link" ? "active" : ""}`}
                onClick={() => setFormat("link")}
              >
                链接
              </button>
              <button
                type="button"
                className={`orbit-compose-segment-btn ${format === "quote" ? "active" : ""}`}
                onClick={() => setFormat("quote")}
              >
                摘录
              </button>
            </div>

            <div className="orbit-compose-header-right">
              {(format === "note" || format === "appreciation") && (
                <button
                  type="button"
                  className="orbit-compose-fullscreen-btn"
                  onClick={handleOpenFullscreen}
                  title="展开全屏长文创作"
                  aria-label="切换长文全屏模式"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          <div className="orbit-compose-body">
            {format === "appreciation" && (
              <div className="orbit-compose-tags-bar" style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                {APPRECIATION_TAGS.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`orbit-appreciation-badge ${selectedTagId === tag.id ? "active" : ""}`}
                    style={{
                      cursor: "pointer",
                      opacity: selectedTagId === null || selectedTagId === tag.id ? 1 : 0.6,
                      transform: selectedTagId === tag.id ? "scale(1.05)" : "scale(1)",
                      transition: "all 0.2s ease",
                    }}
                    onClick={() => setSelectedTagId(selectedTagId === tag.id ? null : tag.id)}
                  >
                    <span>{tag.icon}</span>
                    <span>{tag.label}</span>
                  </button>
                ))}
              </div>
            )}

            {(format === "link" || ((format === "note" || format === "appreciation") && showTitle)) && (
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="添加标题…"
                className="orbit-compose-title-input"
              />
            )}

            {format === "link" && (
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="粘贴目标 URL (https://…)"
                className="orbit-compose-url-input"
              />
            )}

            <div className="orbit-compose-editor-wrapper">
              <TiptapEditor
                ref={editorRef}
                defaultValue={body}
                onChange={setBody}
                mode="note"
                entryId={entryId}
                hideFullscreenToggle
              />
            </div>

            {format === "note" && (
              <MediaAttachmentsBar
                attachments={attachments}
                onRemove={handleRemoveAttachment}
                onUpdateAlt={handleUpdateAlt}
              />
            )}
          </div>

          <div className="orbit-compose-footer">
            <div className="orbit-compose-tools">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*,audio/*"
                multiple
                style={{ display: "none" }}
                onChange={handleImageSelect}
              />
              <button
                type="button"
                className="orbit-compose-tool-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="添加多媒体文件 (图片/视频/音频)"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                {uploading ? "上传中…" : "添加媒体"}
              </button>

              <VoiceInputButton
                onTextUpdate={(text) => {
                  if (text) {
                    editorRef.current?.insertTextAtCursor(text);
                  }
                }}
              />

              <VoiceNoteRecordButton
                entryId={entryId}
                onVoiceNoteCreated={(res) => {
                  const newItem: MediaAttachmentItem = {
                    id: `audio_${Date.now()}`,
                    url: res.url,
                    mimeType: res.mimeType,
                    duration: res.duration,
                    transcript: res.transcript,
                  };
                  setAttachments((prev) => [...prev, newItem]);
                }}
              />

              {format === "note" && (
                <button
                  type="button"
                  className={`orbit-compose-tool-btn ${showTitle ? "active" : ""}`}
                  onClick={() => {
                    const willShow = !showTitle;
                    setShowTitle(willShow);
                    if (willShow) {
                      requestAnimationFrame(() => {
                        titleInputRef.current?.focus();
                      });
                    }
                  }}
                  title={showTitle ? "隐藏标题" : "添加标题"}
                  aria-label={showTitle ? "隐藏标题" : "添加标题"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12h16M4 6h16M4 18h10" />
                  </svg>
                  标题
                </button>
              )}
            </div>

            <button
              type="button"
              className="orbit-btn orbit-btn-primary"
              onClick={() => void handleSubmit()}
              disabled={submitting}
            >
              {submitting ? "发布中…" : "发布"}
            </button>
          </div>
        </div>
      </div>

      <EditorFullscreenOverlay
        open={fullscreenOpen}
        title={title}
        handoff={fullscreenHandoff}
        entryId={entryId}
        saving={submitting}
        onClose={applyFullscreenClose}
        onSave={(detail) => {
          applyFullscreenClose(detail);
          void handleSubmit(detail.html);
        }}
      />
    </>
  );
}
