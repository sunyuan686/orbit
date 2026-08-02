import { useCallback, useEffect, useRef, useState } from "react";
import { NodeSelection } from "@tiptap/pm/state";
import { TiptapEditor, type TiptapEditorHandle } from "./TiptapEditor";
import { CloseIcon } from "./OrbitIcons";
import {
  clampEditorSelection,
  emptyDocJson,
  type EditorHandoffState,
  type EditorFullscreenCloseDetail,
  type EditorSelection,
} from "../lib/editor-handoff";

export interface EditorFullscreenOverlayProps {
  open: boolean;
  title: string;
  handoff: EditorHandoffState | null;
  entryId?: string;
  saving?: boolean;
  onClose: (detail: EditorFullscreenCloseDetail) => void;
  onSave?: (detail: EditorFullscreenCloseDetail) => void;
  onDismiss?: () => void;
}

const ESCAPE_OVERLAY_SELECTOR =
  ".orbit-slash-menu, .orbit-link-toolbar, [data-orbit-bubble-menu], .orbit-image-lightbox-dialog[open]";

function hasActiveEscapeOverlay(root: HTMLElement | null): boolean {
  if (!root) return false;
  return Array.from(root.querySelectorAll<HTMLElement>(ESCAPE_OVERLAY_SELECTOR)).some(
    (el) => getComputedStyle(el).display !== "none" && el.offsetParent !== null,
  );
}

export function EditorFullscreenOverlay({
  open,
  title: initialTitle,
  handoff,
  entryId,
  saving = false,
  onClose,
  onSave,
  onDismiss,
}: EditorFullscreenOverlayProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editorRef = useRef<TiptapEditorHandle>(null);
  const [title, setTitle] = useState(initialTitle);
  const [selection, setSelection] = useState<EditorSelection | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle);
    setSelection(handoff?.selection ?? null);
  }, [open, initialTitle, handoff]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      requestAnimationFrame(() => {
        const editor = editorRef.current?.getEditor();
        if (!editor || editor.isDestroyed) return;
        if (selection && !(editor.state.selection instanceof NodeSelection)) {
          const clamped = clampEditorSelection(editor, selection);
          editor.chain().focus().setTextSelection(clamped).run();
          return;
        }
        editor.commands.focus("end");
      });
      return;
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, selection]);

  const buildCloseDetail = useCallback((): EditorFullscreenCloseDetail => {
    const state = editorRef.current?.getEditorState();
    return {
      json: state?.json ?? handoff?.json ?? emptyDocJson(),
      html: state?.html ?? handoff?.html ?? "",
      title,
      selection: state?.selection ?? selection,
    };
  }, [handoff?.html, handoff?.json, selection, title]);

  const finishClose = useCallback(() => {
    onClose(buildCloseDetail());
  }, [buildCloseDetail, onClose]);

  const handleSaveClick = useCallback(() => {
    onSave?.(buildCloseDetail());
  }, [buildCloseDetail, onSave]);

  const handleDialogCancel = useCallback(
    (event: Event) => {
      event.preventDefault();
      finishClose();
    },
    [finishClose],
  );

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return;

      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        handleSaveClick();
        return;
      }

      if (event.key !== "Escape") return;
      if (hasActiveEscapeOverlay(dialogRef.current)) return;

      event.preventDefault();
      event.stopPropagation();
      finishClose();
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [finishClose, handleSaveClick, open]);

  if (!open || !handoff) return null;

  return (
    <dialog
      ref={dialogRef}
      className="orbit-fullscreen-article-overlay orbit-fullscreen-dialog"
      aria-label="全屏文章模式"
      onCancel={(event) => handleDialogCancel(event.nativeEvent)}
    >
      <div className="orbit-fullscreen-toolbar">
        <div className="orbit-fullscreen-toolbar-inner">
          <button
            type="button"
            className="orbit-editor-tool-btn mr-2"
            onClick={finishClose}
            title="退出全屏文章模式"
            aria-label="退出全屏文章模式"
          >
            <svg
              className="orbit-editor-tool-icon"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.48"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 5.85h2.85V3" />
              <path d="M15 5.85h-2.85V3" />
              <path d="M3 12.15h2.85V15" />
              <path d="M15 12.15h-2.85V15" />
            </svg>
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="orbit-btn mr-2"
              aria-label="关闭"
              title="关闭"
            >
              <CloseIcon />
              关闭
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={handleSaveClick}
              disabled={saving}
              className="orbit-btn orbit-btn-primary"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          )}
        </div>
      </div>

      <div className="orbit-fullscreen-content">
        <div className="orbit-fullscreen-inner">
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
              if (event.key === "Enter") {
                event.preventDefault();
                editorRef.current?.getEditor()?.commands.focus("start");
              }
            }}
            placeholder="标题"
            className="orbit-fullscreen-title-input"
          />

          <TiptapEditor
            key="orbit-fullscreen-editor"
            ref={editorRef}
            defaultValue={handoff.html}
            entryId={entryId}
            mode="article"
            hideFullscreenToggle
          />
        </div>
      </div>
    </dialog>
  );
}
