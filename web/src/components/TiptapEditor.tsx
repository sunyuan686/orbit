import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useLayoutEffect, useCallback, useMemo, useRef, useState } from "react";
import { uploadImage, getApiErrorMessage } from "../lib/api";
import type { CommentItem } from "../lib/api";
import { normalizeBodyForEditor } from "../lib/content";
import { useToast } from "../lib/useToast";
import { CommentHighlight } from "../extensions/CommentHighlight";
import { resolveCommentPosition, getAnchorContext } from "../lib/anchor";
import type { InlineDraft } from "../lib/inlineComment";
import { InlineMarginaliaPopover } from "./InlineMarginaliaPopover";
import { anchorLogger, marginaliaLogger } from "../lib/logger";

const INLINE_DRAFT_MARK_ID = "__draft__";

interface Props {
  defaultValue?: string;
  onChange?: (html: string) => void;
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
  /** 编辑器就绪后回调，用于父组件访问 editor 实例 */
  onEditorCreate?: (editor: Editor) => void;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`orbit-toolbar-btn${active ? " orbit-toolbar-btn--active" : ""}`}
    >
      {children}
    </button>
  );
}

function Toolbar({
  editor,
  onUploadImage,
}: {
  editor: Editor | null;
  onUploadImage: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    (file: File) => {
      if (!editor) return;
      onUploadImage(file);
    },
    [editor, onUploadImage]
  );

  if (!editor) return null;

  const sep = <div className="orbit-toolbar-sep" role="separator" />;

  return (
    <div className="orbit-toolbar tiptap-mobile-toolbar">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="粗体">
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体">
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="删除线">
        <span className="orbit-toolbar-strike">S</span>
      </ToolbarButton>
      {sep}
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="二级标题">
        H2
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="三级标题">
        H3
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="无序列表">
        ≡
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="引用">
        "
      </ToolbarButton>
      {sep}
      <ToolbarButton onClick={() => fileInputRef.current?.click()} title="插入图片">
        🖼
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = "";
        }}
      />
      {sep}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="撤销">
        ↩
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="重做">
        ↪
      </ToolbarButton>
    </div>
  );
}

export function TiptapEditor({
  defaultValue,
  onChange,
  readonly,
  entryId,
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
}: Props) {
  const editorRef = useRef<Editor | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  const uploadImageToEditor = useCallback(
    async (ed: Editor, file: File) => {
      const blobUrl = URL.createObjectURL(file);
      ed.chain().focus().setImage({ src: blobUrl }).run();

      try {
        const url = await uploadImage(file, entryId);
        ed.view.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.src === blobUrl) {
            const tr = ed.view.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: url });
            ed.view.dispatch(tr);
            return false;
          }
        });
      } catch (err) {
        ed.view.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.src === blobUrl) {
            const tr = ed.view.state.tr.delete(pos, pos + node.nodeSize);
            ed.view.dispatch(tr);
            return false;
          }
        });
        toast.error(getApiErrorMessage(err, "图片上传失败"));
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    },
    [entryId, toast]
  );

  const handleImageUpload = useCallback(
    (file: File) => {
      if (!editorRef.current) return;
      void uploadImageToEditor(editorRef.current, file);
    },
    [uploadImageToEditor]
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      CommentHighlight,
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "orbit-prose-img" },
      }),
      Placeholder.configure({ placeholder: "开始写作…" }),
    ],
    content: normalizeBodyForEditor(defaultValue || ""),
    editable: !readonly || enableInlineComments,
    shouldRerenderOnTransaction: !readonly,
    onUpdate: ({ editor: currentEditor }) => {
      if (readonly) {
        return;
      }
      onChange?.(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "orbit-prose",
        ...(readonly ? { "data-readonly": "true" } : {}),
      },
      handleKeyDown: (_view, event) => {
        if (!readonly) {
          return false;
        }
        if (event.metaKey || event.ctrlKey) {
          const key = event.key.toLowerCase();
          if (key === "a" || key === "c") {
            return false;
          }
          return true;
        }
        if (event.key === "Backspace" || event.key === "Delete" || event.key === "Enter") {
          return true;
        }
        if (event.key.length === 1) {
          return true;
        }
        return false;
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
        if (readonly) {
          return true;
        }
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file || !editorRef.current) return true;
            const ed = editorRef.current;
            const blobUrl = URL.createObjectURL(file);
            ed.chain().focus().setImage({ src: blobUrl }).run();
            void uploadImageToEditor(ed, file);
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        if (readonly) {
          return true;
        }
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            if (!editorRef.current) return true;
            const ed = editorRef.current;
            const blobUrl = URL.createObjectURL(file);
            ed.chain().focus().setImage({ src: blobUrl }).run();
            void uploadImageToEditor(ed, file);
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
    editor.setEditable(!readonly || enableInlineComments);
  }, [editor, enableInlineComments, readonly]);

  useEffect(() => {
    editorRef.current = editor;
    if (editor) {
      onEditorCreate?.(editor);
    }
  }, [editor, onEditorCreate]);

  useEffect(() => {
    if (!editor || editor.isDestroyed || readonly) return;
    const current = editor.getHTML();
    if (defaultValue !== undefined && defaultValue !== current) {
      editor.commands.setContent(normalizeBodyForEditor(defaultValue || ""));
    }
  }, [defaultValue, editor, readonly]);

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
      <Toolbar editor={editor} onUploadImage={handleImageUpload} />
      <div className="orbit-editor-body">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
