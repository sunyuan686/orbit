import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
  useImperativeHandle,
} from "react";
import { uploadAsset, getApiErrorMessage } from "../lib/api";
import type { CommentItem } from "../lib/api";
import { normalizeBodyForEditor, combineHtmlAndAttachments, resolveMediaType } from "../lib/content";
import { useToast } from "../hooks/useToast";
import Link from "@tiptap/extension-link";
import { CommentHighlight } from "../extensions/CommentHighlight";
import { OrbitImage } from "../extensions/OrbitImage";
import { OrbitAudio } from "../extensions/OrbitAudio";
import { OrbitVideo } from "../extensions/OrbitVideo";
import { ORBIT_ALLOW_DOC_CHANGE, ReadonlyGuard } from "../extensions/ReadonlyGuard";
import { SlashCommands } from "../extensions/SlashCommands";
import { LinkToolbar } from "../extensions/LinkToolbar";
import { BubbleMenu } from "../extensions/BubbleMenu";
import { InsertParagraphAround } from "../extensions/InsertParagraphAround";
import { EnsureTrailingParagraph } from "../extensions/EnsureTrailingParagraph";
import { LinkInputRules } from "../extensions/LinkInputRules";
import { TabIndent } from "../extensions/TabIndent";
import { resolveCommentPosition, getAnchorContext } from "../lib/anchor";
import type { InlineDraft } from "../lib/inlineComment";
import { InlineMarginaliaPopover } from "./InlineMarginaliaPopover";
import { MediaAttachmentsBar, type MediaAttachmentItem } from "./MediaAttachmentsBar";
import { anchorLogger, marginaliaLogger } from "../lib/logger";
import {
  clampEditorSelection,
  emptyDocJson,
  type EditorHandoffState,
  type EditorSelection,
} from "../lib/editor-handoff";
import { VoiceInputButton } from "./VoiceInputButton";
import { VoiceNoteRecordButton } from "./VoiceNoteRecordButton";

const INLINE_DRAFT_MARK_ID = "__draft__";

export interface TiptapEditorHandle {
  getEditorState: () => EditorHandoffState;
  setEditorState: (json: JSONContent, selection?: EditorSelection | null) => void;
  focusSelection: (selection?: EditorSelection | null) => void;
  getEditor: () => Editor | null;
  insertTextAtCursor: (text: string) => void;
}

interface Props {
  defaultValue?: string;
  defaultJson?: JSONContent;
  onChange?: (html: string) => void;
  onJsonChange?: (json: JSONContent) => void;
  readonly?: boolean;
  entryId?: string;
  inlineComments?: CommentItem[];
  enableInlineComments?: boolean;
  activeInlineCommentId?: string | null;
  inlineDraft?: InlineDraft | null;
  currentAuthor?: string | null;
  onCreateInlineComment?: (draft: InlineDraft) => void;
  onCancelInlineDraft?: () => void;
  onSubmitInlineComment?: (body: string) => Promise<void>;
  onSelectInlineComment?: (id: string) => void;
  /** 编辑器模式：note 随想 / article 长文章 */
  mode?: "note" | "article";
  /** 切换随想/文章模式（全屏展开）回调 */
  onToggleMode?: () => void;
  /** 全屏 overlay 内嵌时隐藏展开按钮 */
  hideFullscreenToggle?: boolean;
  /** 标题展开状态与切换回调 */
  showTitle?: boolean;
  onToggleTitle?: () => void;
  /** 编辑器就绪后回调，用于父组件访问 editor 实例 */
  onEditorCreate?: (editor: Editor) => void;
}

export const TiptapEditor = forwardRef<TiptapEditorHandle, Props>(function TiptapEditor(
  {
    defaultValue,
    defaultJson,
    onChange,
    onJsonChange,
    readonly,
    entryId,
    mode = "article",
    onToggleMode,
    hideFullscreenToggle = false,
    showTitle = false,
    onToggleTitle,
    inlineComments = [],
    enableInlineComments = false,
    activeInlineCommentId,
    inlineDraft = null,
    currentAuthor,
    onCreateInlineComment,
    onCancelInlineDraft,
    onSubmitInlineComment,
    onSelectInlineComment,
    onEditorCreate,
  },
  ref,
) {
  const editorRef = useRef<Editor | null>(null);
  const bodyJsonRef = useRef<JSONContent>(defaultJson ?? emptyDocJson());
  const lastSelectionRef = useRef<EditorSelection | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [selectionMenu, setSelectionMenu] = useState<{
    top: number;
    left: number;
    quote: string;
    anchorFrom: number;
    anchorTo: number;
    anchorPrefix: string;
    anchorSuffix: string;
  } | null>(null);
  const [draftPopover, setDraftPopover] = useState<{ top: number; left: number } | null>(null);
  const startingInlineDraftRef = useRef(false);

  const inlineCommentKey = useMemo(
    () =>
      inlineComments
        .map((comment) => `${comment.id}:${comment.anchorFrom}:${comment.anchorTo}`)
        .join("|"),
    [inlineComments]
  );

  const uploadMediaToEditor = useCallback(
    async (ed: Editor, file: File) => {
      const mediaType = resolveMediaType({ file });
      if (mediaType === "video") {
        try {
          const res = await uploadAsset(file, entryId);
          if (!ed.isDestroyed) {
            ed.chain().focus().setVideo({ src: res.url }).run();
          }
        } catch (err) {
          toast.error(getApiErrorMessage(err, "视频上传失败"));
        }
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      ed.chain().focus().setImage({ src: blobUrl }).run();

      try {
        const res = await uploadAsset(file, entryId);
        // 先预加载正式 URL，再换 src，避免 blob→远程替换时闪白
        // 用 createElement，避免与 TipTap Image 扩展同名冲突
        await new Promise<void>((resolve) => {
          const img = document.createElement("img");
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = res.url;
        });
        if (ed.isDestroyed) return;
        ed.view.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.src === blobUrl) {
            const tr = ed.view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              src: res.url,
              width: res.width ?? node.attrs.width,
              height: res.height ?? node.attrs.height,
              blurhash: res.blurhash ?? node.attrs.blurhash,
            });
            ed.view.dispatch(tr);
            return false;
          }
        });
      } catch (err) {
        if (!ed.isDestroyed) {
          ed.view.state.doc.descendants((node, pos) => {
            if (node.type.name === "image" && node.attrs.src === blobUrl) {
              const tr = ed.view.state.tr.delete(pos, pos + node.nodeSize);
              ed.view.dispatch(tr);
              return false;
            }
          });
        }
        toast.error(getApiErrorMessage(err, "图片上传失败"));
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    },
    [entryId, toast]
  );

  const initialContent = useMemo(() => {
    if (defaultJson) return defaultJson;
    return normalizeBodyForEditor(defaultValue || "");
  }, [defaultJson, defaultValue]);

  const [attachments, setAttachments] = useState<MediaAttachmentItem[]>([]);
  const attachmentsRef = useRef(attachments);
  const speechRangeRef = useRef<{ from: number; to: number } | null>(null);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleUpdateAlt = useCallback((id: string, alt: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, alt } : a))
    );
  }, []);

  const handleUpdateTranscript = useCallback((id: string, transcript: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, transcript } : a))
    );
  }, []);

  const handleMediaUpload = useCallback(
    async (file: File) => {
      if (mode === "note") {
        try {
          const res = await uploadAsset(file, entryId);
          const type = resolveMediaType({ file, mimeType: res.mimeType, url: res.url });
          const newItem: MediaAttachmentItem = {
            id: `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            url: res.url,
            mimeType: res.mimeType,
            width: res.width,
            height: res.height,
            duration: res.duration,
            transcript: res.transcript,
          };
          setAttachments((prev) => [...prev, newItem]);
        } catch (err) {
          toast.error(getApiErrorMessage(err, "文件上传失败"));
        }
      } else {
        if (!editorRef.current) return;
        void uploadMediaToEditor(editorRef.current, file);
      }
    },
    [mode, entryId, uploadMediaToEditor, toast]
  );

  const emitChange = useCallback(
    (rawHtml: string, currentAttachments: MediaAttachmentItem[]) => {
      if (mode === "note") {
        onChange?.(combineHtmlAndAttachments(rawHtml, currentAttachments));
      } else {
        onChange?.(rawHtml);
      }
    },
    [mode, onChange]
  );

  useEffect(() => {
    if (mode === "note" && editorRef.current && !editorRef.current.isDestroyed && !readonly) {
      emitChange(editorRef.current.getHTML(), attachments);
    }
  }, [attachments, mode, readonly, emitChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          class: "orbit-link",
        },
      }),
      ReadonlyGuard,
      CommentHighlight,
      OrbitImage.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "orbit-prose-img" },
      }),
      OrbitAudio,
      OrbitVideo,
      Placeholder.configure({
        placeholder: mode === "note" ? "记录这一刻的随手记与思想…" : "开始写作，或输入 '/' 唤起快捷菜单…",
      }),
      SlashCommands.configure({
        onUploadImageRequest: () => {
          fileInputRef.current?.click();
        },
      }),
      LinkToolbar,
      BubbleMenu,
      InsertParagraphAround,
      EnsureTrailingParagraph,
      LinkInputRules,
      TabIndent,
    ],
    autofocus: readonly ? false : "end",
    content: initialContent,
    editable: !readonly,
    shouldRerenderOnTransaction: !readonly,
    onUpdate: ({ editor: currentEditor }) => {
      if (readonly) {
        return;
      }
      const json = currentEditor.getJSON();
      bodyJsonRef.current = json;
      onJsonChange?.(json);
      emitChange(currentEditor.getHTML(), attachmentsRef.current);
    },
    editorProps: {
      attributes: {
        class: "orbit-prose",
        ...(readonly ? { "data-readonly": "true", tabindex: "0" } : {}),
      },
      handleClick: (_view, _pos, event) => {
        const target = event.target as HTMLElement | null;
        const mark = target?.closest?.("[data-comment-id]") as HTMLElement | null;
        const commentId = mark?.dataset.commentId;
        if (commentId && commentId !== INLINE_DRAFT_MARK_ID) {
          onSelectInlineComment?.(commentId);
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/") || item.type.startsWith("video/") || item.type.startsWith("audio/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return true;
            if (mode === "note") {
              void handleMediaUpload(file);
            } else if (editorRef.current) {
              void uploadMediaToEditor(editorRef.current, file);
            }
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/") || file.type.startsWith("video/") || file.type.startsWith("audio/")) {
            event.preventDefault();
            if (mode === "note") {
              void handleMediaUpload(file);
            } else if (editorRef.current) {
              void uploadMediaToEditor(editorRef.current, file);
            }
            return true;
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      return;
    }
    editor.setEditable(!readonly);
  }, [editor, readonly]);

  useEffect(() => {
    editorRef.current = editor;
    if (editor) {
      bodyJsonRef.current = editor.getJSON();
      onEditorCreate?.(editor);
    }
  }, [editor, onEditorCreate]);

  const lastDefaultValueRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!editor || editor.isDestroyed || defaultJson) return;
    if (defaultValue === lastDefaultValueRef.current) return;
    lastDefaultValueRef.current = defaultValue;

    const normalized = normalizeBodyForEditor(defaultValue || "");
    editor.commands.setContent(normalized, { emitUpdate: false });
  }, [editor, defaultValue, defaultJson]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || readonly) return;

    const syncEditorMinHeight = () => {
      const dom = editor.view.dom as HTMLElement;
      if (dom) {
        dom.style.minHeight = mode === "note" ? "120px" : "320px";
      }
    };

    syncEditorMinHeight();
  }, [editor, mode, readonly]);

  const handleEditorBodyMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const currentEditor = editorRef.current;
      if (!currentEditor || currentEditor.isDestroyed || readonly) return;

      const target = event.target as HTMLElement;
      if (target.closest(".ProseMirror")) return;

      if (currentEditor.state.selection instanceof NodeSelection) {
        event.preventDefault();
        currentEditor.chain().focus("end").run();
      }
    },
    [readonly],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const trackSelection = () => {
      const { from, to } = editor.state.selection;
      lastSelectionRef.current = { from, to };
    };

    editor.on("selectionUpdate", trackSelection);
    trackSelection();
    return () => {
      editor.off("selectionUpdate", trackSelection);
    };
  }, [editor]);

  const readEditorSelection = useCallback((): EditorSelection | null => {
    const currentEditor = editorRef.current;
    if (!currentEditor || currentEditor.isDestroyed) {
      return lastSelectionRef.current;
    }
    if (currentEditor.state.selection instanceof NodeSelection) {
      return null;
    }
    const { from, to } = currentEditor.state.selection;
    return { from, to };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      getEditorState: () => {
        const currentEditor = editorRef.current;
        const json = currentEditor && !currentEditor.isDestroyed
          ? currentEditor.getJSON()
          : bodyJsonRef.current;
        const rawHtml = currentEditor && !currentEditor.isDestroyed
          ? currentEditor.getHTML()
          : "";
        return {
          json,
          html: rawHtml,
          selection: readEditorSelection(),
        };
      },
      setEditorState: (json, selection) => {
        const currentEditor = editorRef.current;
        if (!currentEditor || currentEditor.isDestroyed) {
          bodyJsonRef.current = json;
          return;
        }
        currentEditor.commands.setContent(json, { emitUpdate: false });
        bodyJsonRef.current = json;
        onJsonChange?.(json);
        emitChange(currentEditor.getHTML(), attachmentsRef.current);
        if (selection && !(currentEditor.state.selection instanceof NodeSelection)) {
          const clamped = clampEditorSelection(currentEditor, selection);
          lastSelectionRef.current = clamped;
          currentEditor.chain().focus().setTextSelection(clamped).run();
        } else {
          currentEditor.commands.focus("end");
        }
      },
      focusSelection: (selection) => {
        const currentEditor = editorRef.current;
        if (!currentEditor || currentEditor.isDestroyed) {
          return;
        }
        if (currentEditor.state.selection instanceof NodeSelection) {
          currentEditor.commands.focus("end");
          return;
        }
        const targetSelection = selection ?? readEditorSelection();
        if (!targetSelection) {
          currentEditor.commands.focus("end");
          return;
        }
        const clamped = clampEditorSelection(currentEditor, targetSelection);
        lastSelectionRef.current = clamped;
        currentEditor.chain().focus().setTextSelection(clamped).run();
      },
      getEditor: () => {
        const currentEditor = editorRef.current;
        if (!currentEditor || currentEditor.isDestroyed) {
          return null;
        }
        return currentEditor;
      },
      insertTextAtCursor: (text: string) => {
        const currentEditor = editorRef.current;
        if (!currentEditor || currentEditor.isDestroyed) return;
        currentEditor.chain().focus().insertContent(text).run();
      },
    }),
    [onChange, onJsonChange, readEditorSelection],
  );

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (defaultJson !== undefined || defaultValue === undefined) return;
    const next = normalizeBodyForEditor(defaultValue || "");
    const current = editor.getHTML();
    if (next !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [defaultValue, editor]);

  const updateSelectionMenu = useCallback(() => {
    const currentEditor = editorRef.current;
    if (!currentEditor || currentEditor.isDestroyed || !readonly) {
      return;
    }
    if (!enableInlineComments || !onCreateInlineComment || inlineDraft) {
      setSelectionMenu(null);
      return;
    }

    const { from, to, empty } = currentEditor.state.selection;
    if (empty || from === to) {
      setSelectionMenu(null);
      return;
    }

    const quote = currentEditor.state.doc.textBetween(from, to, " ").trim();
    if (!quote) {
      setSelectionMenu(null);
      return;
    }

    const { prefix, suffix } = getAnchorContext(currentEditor, from, to);
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) {
      return;
    }

    try {
      const coords = currentEditor.view.coordsAtPos(to);
      setSelectionMenu({
        top: coords.bottom - wrapperRect.top + 8,
        left: Math.min(Math.max(coords.left - wrapperRect.left, 0), wrapperRect.width - 110),
        quote,
        anchorFrom: from,
        anchorTo: to,
        anchorPrefix: prefix,
        anchorSuffix: suffix,
      });
    } catch {
      setSelectionMenu(null);
    }
  }, [enableInlineComments, inlineDraft, onCreateInlineComment, readonly]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !readonly || !enableInlineComments) {
      return;
    }

    const hideSelectionMenu = () => {
      window.setTimeout(() => {
        const currentEditor = editorRef.current;
        if (!currentEditor || currentEditor.isDestroyed) {
          return;
        }
        const { empty } = currentEditor.state.selection;
        if (empty) {
          setSelectionMenu(null);
        }
      }, 160);
    };

    const scheduleSelectionMenuUpdate = () => {
      window.requestAnimationFrame(() => updateSelectionMenu());
    };

    const handleTransaction = ({ transaction }: { transaction: { selectionSet: boolean } }) => {
      if (transaction.selectionSet) {
        scheduleSelectionMenuUpdate();
      }
    };

    editor.on("selectionUpdate", updateSelectionMenu);
    editor.on("transaction", handleTransaction);
    editor.on("blur", hideSelectionMenu);

    const dom = editor.view.dom;
    dom.addEventListener("mouseup", scheduleSelectionMenuUpdate);
    dom.addEventListener("keyup", scheduleSelectionMenuUpdate);

    return () => {
      editor.off("selectionUpdate", updateSelectionMenu);
      editor.off("transaction", handleTransaction);
      editor.off("blur", hideSelectionMenu);
      dom.removeEventListener("mouseup", scheduleSelectionMenuUpdate);
      dom.removeEventListener("keyup", scheduleSelectionMenuUpdate);
    };
  }, [editor, enableInlineComments, readonly, updateSelectionMenu]);

  const updateDraftPopover = useCallback(() => {
    const currentEditor = editorRef.current;
    if (!inlineDraft || !currentEditor || currentEditor.isDestroyed) {
      setDraftPopover(null);
      return;
    }

    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    if (!wrapperRect) {
      return;
    }

    try {
      const coords = currentEditor.view.coordsAtPos(inlineDraft.anchorTo);
      setDraftPopover({
        top: coords.bottom - wrapperRect.top + 8,
        left: Math.min(Math.max(coords.left - wrapperRect.left, 0), wrapperRect.width - 300),
      });
    } catch (err) {
      marginaliaLogger.warn("Failed to position inline draft popover", {
        error: err instanceof Error ? err.message : String(err),
      });
      setDraftPopover(null);
    }
  }, [inlineDraft]);

  useLayoutEffect(() => {
    updateDraftPopover();

    const main = document.querySelector("main");
    main?.addEventListener("scroll", updateDraftPopover, { passive: true });
    window.addEventListener("resize", updateDraftPopover);

    const editorRoot = document.querySelector(".orbit-read-editor");
    const resizeObserver =
      editorRoot && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => updateDraftPopover())
        : null;
    if (editorRoot && resizeObserver) {
      resizeObserver.observe(editorRoot);
    }

    return () => {
      main?.removeEventListener("scroll", updateDraftPopover);
      window.removeEventListener("resize", updateDraftPopover);
      resizeObserver?.disconnect();
    };
  }, [updateDraftPopover]);

  useEffect(() => {
    if (!inlineDraft) {
      return;
    }
    setSelectionMenu(null);

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target || wrapperRef.current?.contains(target)) {
        return;
      }
      onCancelInlineDraft?.();
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [inlineDraft, onCancelInlineDraft]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !readonly) return;

    const markType = editor.schema.marks.commentHighlight;
    if (!markType) return;

    let tr = editor.state.tr;
    // 先清除所有已有的高亮 mark（data-comment-id 标记的也可能来自其他渲染）
    tr = tr.removeMark(0, editor.state.doc.content.size, markType);

    let orphanCount = 0;
    let positionHitCount = 0;
    let textSearchCount = 0;

    for (const comment of inlineComments) {
      // 使用混合锚定算法查找正确位置
      const resolved = resolveCommentPosition(editor, {
        anchorFrom: comment.anchorFrom,
        anchorTo: comment.anchorTo,
        quote: comment.quote,
        anchorPrefix: comment.anchorPrefix,
        anchorSuffix: comment.anchorSuffix,
      });

      if (!resolved) {
        orphanCount++;
        continue; // 无法定位，仅展示在边注面板中
      }

      // 统计命中方式
      if (
        typeof comment.anchorFrom === "number" &&
        typeof comment.anchorTo === "number" &&
        resolved.from === comment.anchorFrom &&
        resolved.to === comment.anchorTo
      ) {
        positionHitCount++;
      } else {
        textSearchCount++;
      }

      try {
        tr = tr.addMark(
          resolved.from,
          resolved.to,
          markType.create({ commentId: comment.id })
        );
      } catch (err) {
        orphanCount++;
        anchorLogger.warn("Failed to apply inline highlight mark", {
          commentId: comment.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (inlineDraft) {
      try {
        tr = tr.addMark(
          inlineDraft.anchorFrom,
          inlineDraft.anchorTo,
          markType.create({ commentId: INLINE_DRAFT_MARK_ID })
        );
      } catch (err) {
        anchorLogger.warn("Failed to apply draft highlight mark", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (tr.docChanged) {
      try {
        tr.setMeta(ORBIT_ALLOW_DOC_CHANGE, true);
        editor.view.dispatch(tr);
        if (inlineDraft) {
          window.requestAnimationFrame(() => updateDraftPopover());
        }
      } catch (err) {
        anchorLogger.warn("Failed to dispatch inline highlight marks", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 开发环境下打印锚定统计
    if (inlineComments.length > 0) {
      const total = inlineComments.length;
      if (orphanCount > 0 || textSearchCount > 0) {
        anchorLogger.debug("inline highlight stats", {
          total,
          positionHitCount,
          textSearchCount,
          orphanCount,
        });
      }
    }
  }, [editor, inlineCommentKey, inlineComments, inlineDraft, readonly, updateDraftPopover]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !activeInlineCommentId) return;
    const target = inlineComments.find((comment) => comment.id === activeInlineCommentId);
    if (!target || typeof target.anchorFrom !== "number") return;

    try {
      const coords = editor.view.coordsAtPos(target.anchorFrom);
      window.scrollTo({
        top: window.scrollY + coords.top - 140,
        behavior: "smooth",
      });
    } catch {
      // Stale anchors are still useful in the comment panel via quote fallback.
    }
  }, [activeInlineCommentId, editor, inlineComments]);

  useEffect(() => {
    if (!readonly) return;
    const editorRoot = document.querySelector(".orbit-read-editor");
    if (!editorRoot) return;

    editorRoot.querySelectorAll(".orbit-comment-highlight").forEach((node) => {
      const element = node as HTMLElement;
      const commentId = element.dataset.commentId;
      const isActive =
        commentId === activeInlineCommentId || commentId === INLINE_DRAFT_MARK_ID;
      element.classList.toggle("orbit-comment-highlight--active", isActive);
    });
  }, [activeInlineCommentId, inlineComments, inlineDraft, readonly]);

  const startInlineDraftFromSelection = useCallback(() => {
    if (!selectionMenu || !onCreateInlineComment || startingInlineDraftRef.current) {
      return;
    }
    startingInlineDraftRef.current = true;
    onCreateInlineComment({
      quote: selectionMenu.quote,
      anchorFrom: selectionMenu.anchorFrom,
      anchorTo: selectionMenu.anchorTo,
      anchorPrefix: selectionMenu.anchorPrefix,
      anchorSuffix: selectionMenu.anchorSuffix,
    });
    setSelectionMenu(null);
    window.setTimeout(() => {
      startingInlineDraftRef.current = false;
    }, 0);
  }, [onCreateInlineComment, selectionMenu]);

  if (readonly) {
    // 只读模式：直接渲染内容，无边框无背景
    return (
      <div ref={wrapperRef} className="orbit-read-editor" data-readonly={readonly ? "true" : undefined}>
        <EditorContent editor={editor} />
        {selectionMenu && (
          <button
            type="button"
            className="orbit-selection-comment-btn"
            style={{ top: selectionMenu.top, left: selectionMenu.left }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              startInlineDraftFromSelection();
            }}
            onClick={(event) => {
              event.preventDefault();
              startInlineDraftFromSelection();
            }}
          >
            添加边注
          </button>
        )}
        {inlineDraft && onSubmitInlineComment && (
          <div
            className="orbit-inline-marginalia-popover-anchor"
            style={
              draftPopover
                ? { top: draftPopover.top, left: draftPopover.left }
                : { top: 0, left: 0, visibility: "hidden" as const }
            }
          >
            <InlineMarginaliaPopover
              authorName={currentAuthor}
              onSubmit={onSubmitInlineComment}
              onCancel={() => onCancelInlineDraft?.()}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="orbit-editor-chrome">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            for (let i = 0; i < files.length; i++) {
              handleMediaUpload(files[i]);
            }
          }
          e.target.value = "";
        }}
      />
      <div className="orbit-editor-body" onMouseDown={handleEditorBodyMouseDown}>
        <EditorContent editor={editor} />
        {mode === "note" && (
          <MediaAttachmentsBar
            attachments={attachments}
            onRemove={handleRemoveAttachment}
            onUpdateAlt={handleUpdateAlt}
            onUpdateTranscript={handleUpdateTranscript}
          />
        )}
      </div>

      {/* 底部工具栏 (仅在随想 Note 模式下显示；全屏 Article 沉浸文章模式下隐藏，保持 100% 纯净) */}
      {mode === "note" && (
        <div className="orbit-editor-toolbar">
          <div className="orbit-editor-toolbar-left">
            <button
              type="button"
              className="orbit-editor-tool-btn"
              onClick={() => fileInputRef.current?.click()}
              title="图片/媒体"
              data-tooltip="图片"
              aria-label="上传媒体/图片"
            >
              <svg className="orbit-editor-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </button>

            <VoiceInputButton
              className="orbit-editor-tool-btn"
              compact
              onStreamStart={() => {
                const currentEditor = editorRef.current;
                if (currentEditor && !currentEditor.isDestroyed) {
                  const from = currentEditor.state.selection.from;
                  speechRangeRef.current = { from, to: from };
                }
              }}
              onTextUpdate={(text) => {
                const currentEditor = editorRef.current;
                if (!currentEditor || currentEditor.isDestroyed || !text) return;

                if (!speechRangeRef.current) {
                  const from = currentEditor.state.selection.from;
                  currentEditor.chain().focus().insertContent(text).run();
                  speechRangeRef.current = { from, to: from + text.length };
                } else {
                  const { from, to } = speechRangeRef.current;
                  currentEditor
                    .chain()
                    .focus()
                    .deleteRange({ from, to })
                    .insertContentAt(from, text)
                    .run();
                  speechRangeRef.current = { from, to: from + text.length };
                }
              }}
              onStreamEnd={() => {
                speechRangeRef.current = null;
              }}
            />

            <VoiceNoteRecordButton
              className="orbit-editor-tool-btn"
              compact
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

            {onToggleTitle && (
              <button
                type="button"
                className={`orbit-editor-tool-btn ${showTitle ? "active" : ""}`}
                onClick={onToggleTitle}
                title={showTitle ? "隐藏标题" : "添加标题"}
                data-tooltip={showTitle ? "隐藏标题" : "添加标题"}
                aria-label={showTitle ? "隐藏标题" : "添加标题"}
              >
                <svg className="orbit-editor-tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7V5h16v2" />
                  <path d="M12 5v14" />
                  <path d="M9 19h6" />
                </svg>
              </button>
            )}
          </div>

          {onToggleMode && !hideFullscreenToggle && (
            <div className="orbit-editor-tool-view-group">
              <button
                type="button"
                className="orbit-editor-tool-btn orbit-editor-fullscreen-btn"
                onClick={onToggleMode}
                title="展开全屏文章模式"
                data-tooltip="全屏编辑"
                aria-label="切换全屏文章模式"
              >
                <svg className="orbit-editor-tool-icon" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.48" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5.85 3H3v2.85" />
                  <path d="M12.15 3H15v2.85" />
                  <path d="M3 12.15V15h2.85" />
                  <path d="M15 12.15V15h-2.85" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
