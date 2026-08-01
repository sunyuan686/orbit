import React, { useState, useRef, useEffect, useCallback } from "react";
import { TiptapEditor, type TiptapEditorHandle } from "./TiptapEditor";
import { EditorFullscreenOverlay } from "./EditorFullscreenOverlay";
import { MediaAttachmentsBar, type MediaAttachmentItem } from "./MediaAttachmentsBar";
import { uploadImage } from "../lib/api";
import type { EditorHandoffState } from "../lib/editor-handoff";

export type ComposeFormat = "note" | "link" | "quote";
export type ComposeMode = "note" | "article";

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
  const [linkUrl, setLinkUrl] = useState("");
  const [body, setBody] = useState("");
  const bodyRef = useRef(body);
  const [attachments, setAttachments] = useState<MediaAttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenHandoff, setFullscreenHandoff] = useState<EditorHandoffState | null>(null);
  const [lastComposeMode, setLastComposeMode] = useState<ComposeMode>(defaultMode);

  const fileInputRef = useRef<HTMLInputElement>(null);
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
    }
  }, [isOpen, defaultFormat, defaultMode]);

  const applyFullscreenClose = useCallback((detail: {
    html: string;
    title: string;
    selection: EditorHandoffState["selection"];
    json: EditorHandoffState["json"];
  }) => {
    bodyRef.current = detail.html;
    setBody(detail.html);
    setTitle(detail.title);
    setLastComposeMode("article");
    setFullscreenOpen(false);
    setFullscreenHandoff(null);
    requestAnimationFrame(() => {
      editorRef.current?.setEditorState(detail.json, detail.selection);
      editorRef.current?.focusSelection(detail.selection);
    });
  }, []);

  const handleOpenFullscreen = useCallback(() => {
    if (format !== "note") return;
    const state = editorRef.current?.getEditorState();
    if (!state) return;
    setFullscreenHandoff(state);
    setFullscreenOpen(true);
  }, [format]);

  const handleSubmit = useCallback(async (bodyOverride?: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit?.({
        format,
        mode: lastComposeMode,
        title: title.trim(),
        body: bodyOverride ?? bodyRef.current,
        attachments,
        linkUrl: linkUrl.trim(),
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
        const res = await uploadImage(file, entryId);
        const newItem: MediaAttachmentItem = {
          id: `img_${Date.now()}_${i}`,
          url: res.url,
          width: res.width,
          height: res.height,
        };
        setAttachments((prev) => [...prev, newItem]);
      }
    } catch (err) {
      console.error("Failed to upload image attachment", err);
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
              {format === "note" && (
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
            {format === "link" && (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="添加文章标题…"
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
                accept="image/*"
                multiple
                style={{ display: "none" }}
                onChange={handleImageSelect}
              />
              <button
                type="button"
                className="orbit-compose-tool-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="添加图片"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                </svg>
                {uploading ? "上传中…" : "添加图片"}
              </button>
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
