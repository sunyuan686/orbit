import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useRef } from "react";
import { uploadImage, getApiErrorMessage } from "../lib/api";
import { normalizeBodyForEditor } from "../lib/content";
import { useToast } from "../lib/useToast";

interface Props {
  defaultValue?: string;
  onChange?: (html: string) => void;
  readonly?: boolean;
  entryId?: string;
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
      style={{
        minWidth: "32px",
        height: "32px",
        padding: "0 0.4rem",
        borderRadius: "5px",
        fontSize: "var(--type-secondary)",
        fontWeight: 500,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : 1,
        background: active ? "var(--color-border)" : "transparent",
        color: active ? "var(--color-text-primary)" : "var(--color-text-secondary)",
        transition: "background 0.1s, color 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !active) {
          (e.currentTarget as HTMLButtonElement).style.background = "var(--color-surface-raised)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = active ? "var(--color-border)" : "transparent";
        }
      }}
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

  const sep = (
    <div style={{ width: "1px", height: "18px", background: "var(--color-border-light)", margin: "0 4px" }} />
  );

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "2px",
        padding: "0.4rem 0.5rem",
        borderBottom: "1px solid var(--color-border-light)",
        background: "var(--color-surface)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="粗体">
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="斜体">
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="删除线">
        <span style={{ textDecoration: "line-through" }}>S</span>
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

export function TiptapEditor({ defaultValue, onChange, readonly, entryId }: Props) {
  const editorRef = useRef<Editor | null>(null);
  const toast = useToast();

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
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: { class: "orbit-prose-img" },
      }),
      Placeholder.configure({ placeholder: "开始写作…" }),
    ],
    content: normalizeBodyForEditor(defaultValue || ""),
    editable: !readonly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: { class: "orbit-prose" },
      handlePaste: (_view, event) => {
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
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getHTML();
    if (defaultValue !== undefined && defaultValue !== current) {
      editor.commands.setContent(normalizeBodyForEditor(defaultValue || ""));
    }
  }, [defaultValue, editor]);

  if (readonly) {
    // 只读模式：直接渲染内容，无边框无背景
    return <EditorContent editor={editor} />;
  }

  return (
    <div
      style={{
        border: "1px solid var(--color-border-light)",
        borderRadius: "10px",
        overflow: "hidden",
        background: "var(--color-surface)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Toolbar editor={editor} onUploadImage={handleImageUpload} />
      <div style={{ padding: "0.75rem 1rem" }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
