import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useRef } from "react";
import { uploadImage } from "../lib/api";

interface Props {
  defaultValue?: string;
  onChange?: (markdown: string) => void;
  readonly?: boolean;
  entryId?: string;
}

// 把编辑器的 HTML 内容转为简单 Markdown（仅用于保存）
function htmlToMarkdown(editor: Editor): string {
  // 直接返回 editor 的文本 + 简化的 markdown
  // TipTap 可直接存储 HTML，这里返回 HTML 以便完整保存
  return editor.getHTML();
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
      className={[
        "min-w-[36px] h-9 px-2 rounded text-sm font-medium transition-colors",
        "hover:bg-stone-100 dark:hover:bg-stone-700",
        "disabled:opacity-30 disabled:cursor-not-allowed",
        active
          ? "bg-stone-200 dark:bg-stone-600 text-stone-900 dark:text-stone-100"
          : "text-stone-600 dark:text-stone-400",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!editor) return;

      // 1. 立即插入 blob 占位符，不阻塞输入
      const blobUrl = URL.createObjectURL(file);
      editor.chain().focus().setImage({ src: blobUrl }).run();

      try {
        // 2. 后台上传
        const url = await uploadImage(file);

        // 3. 替换 blob URL 为真实 URL
        editor.view.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.src === blobUrl) {
            const transaction = editor.view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              src: url,
            });
            editor.view.dispatch(transaction);
            return false;
          }
        });
      } catch {
        // 上传失败：移除占位符
        editor.view.state.doc.descendants((node, pos) => {
          if (node.type.name === "image" && node.attrs.src === blobUrl) {
            const transaction = editor.view.state.tr.delete(pos, pos + node.nodeSize);
            editor.view.dispatch(transaction);
            return false;
          }
        });
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    },
    [editor]
  );

  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 sticky bottom-0 md:top-0 md:bottom-auto z-10">
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive("bold")}
        title="粗体"
      >
        <strong>B</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive("italic")}
        title="斜体"
      >
        <em>I</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive("strike")}
        title="删除线"
      >
        <span className="line-through">S</span>
      </ToolbarButton>

      <div className="w-px h-5 bg-stone-200 dark:bg-stone-700 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        active={editor.isActive("heading", { level: 2 })}
        title="二级标题"
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        active={editor.isActive("heading", { level: 3 })}
        title="三级标题"
      >
        H3
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive("bulletList")}
        title="无序列表"
      >
        ≡
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        active={editor.isActive("blockquote")}
        title="引用"
      >
        "
      </ToolbarButton>

      <div className="w-px h-5 bg-stone-200 dark:bg-stone-700 mx-1" />

      {/* 图片插入 */}
      <ToolbarButton
        onClick={() => fileInputRef.current?.click()}
        title="插入图片"
      >
        🖼
      </ToolbarButton>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImageUpload(file);
          e.target.value = "";
        }}
      />

      <div className="w-px h-5 bg-stone-200 dark:bg-stone-700 mx-1" />

      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="撤销"
      >
        ↩
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="重做"
      >
        ↪
      </ToolbarButton>
    </div>
  );
}

export function TiptapEditor({ defaultValue, onChange, readonly, entryId }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "max-w-full rounded-lg my-3",
        },
      }),
      Placeholder.configure({
        placeholder: "开始写作…",
      }),
    ],
    content: defaultValue || "",
    editable: !readonly,
    onUpdate: ({ editor }) => {
      onChange?.(htmlToMarkdown(editor));
    },
    editorProps: {
      attributes: {
        class: [
          "prose prose-stone dark:prose-invert max-w-none",
          "min-h-[200px] px-4 py-4 focus:outline-none",
          "text-stone-800 dark:text-stone-200",
        ].join(" "),
      },
      // 粘贴图片处理
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of Array.from(items)) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file || !editor) return true;

            const blobUrl = URL.createObjectURL(file);
            editor.chain().focus().setImage({ src: blobUrl }).run();

            uploadImage(file, entryId)
              .then((url) => {
                editor.view.state.doc.descendants((node, pos) => {
                  if (node.type.name === "image" && node.attrs.src === blobUrl) {
                    const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, {
                      ...node.attrs,
                      src: url,
                    });
                    editor.view.dispatch(tr);
                    return false;
                  }
                });
              })
              .catch(() => {
                editor.view.state.doc.descendants((node, pos) => {
                  if (node.type.name === "image" && node.attrs.src === blobUrl) {
                    const tr = editor.view.state.tr.delete(pos, pos + node.nodeSize);
                    editor.view.dispatch(tr);
                    return false;
                  }
                });
              })
              .finally(() => URL.revokeObjectURL(blobUrl));

            return true;
          }
        }
        return false;
      },
      // 拖拽图片处理
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;

        for (const file of Array.from(files)) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            if (!editor) return true;

            const blobUrl = URL.createObjectURL(file);
            editor.chain().focus().setImage({ src: blobUrl }).run();

            uploadImage(file, entryId)
              .then((url) => {
                editor.view.state.doc.descendants((node, pos) => {
                  if (node.type.name === "image" && node.attrs.src === blobUrl) {
                    const tr = editor.view.state.tr.setNodeMarkup(pos, undefined, {
                      ...node.attrs,
                      src: url,
                    });
                    editor.view.dispatch(tr);
                    return false;
                  }
                });
              })
              .catch(() => {})
              .finally(() => URL.revokeObjectURL(blobUrl));

            return true;
          }
        }
        return false;
      },
    },
  });

  // 外部内容变化时同步到编辑器
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getHTML();
    if (defaultValue !== undefined && defaultValue !== current) {
      editor.commands.setContent(defaultValue || "");
    }
  }, [defaultValue, editor]);

  return (
    <div className="border border-stone-200 dark:border-stone-700 rounded-xl overflow-hidden bg-white dark:bg-stone-900 flex flex-col">
      {!readonly && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
