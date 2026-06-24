import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { authClient, fetchEntry, saveEntry, createEntry, fetchComments, TYPE_LABEL, getApiErrorMessage, shouldToastApiError, type CommentItem, type CommentPositionMapping } from "../lib/api";
import { resolveCommentPosition } from "../lib/anchor";
import { isEmptyBody } from "../lib/content";
import { setPageTitle } from "../lib/pageTitle";
import { resolveEditorAuthor } from "../lib/authors";
import { canEditContent } from "../lib/contentPolicies";
import { useToast } from "../lib/useToast";
import type { Editor } from "@tiptap/react";
import { TiptapEditor } from "../components/TiptapEditor";

/** Unix 秒 → YYYY-MM-DD（本地时区） */
function toDateInput(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → 当地 00:00 的 Unix 秒 */
function fromDateInput(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000);
}

export function ArticleEdit() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: session } = authClient.useSession();
  // id 缺失、为 "new"、或非法（如 "undefined"）时都视为新建
  const isNew = !id || id === "new" || id === "undefined";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [entryAuthor, setEntryAuthor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(body);
  // 边注位置重映射：保存时用混合锚定算法重新查找位置
  const inlineCommentsRef = useRef<CommentItem[]>([]);
  const editorRef = useRef<Editor | null>(null);
  const displayAuthor = resolveEditorAuthor(entryAuthor, session?.user?.name);
  const isMemo = type === "memo";
  // 发生日期：新建默认今天；memo 不展示
  const [entryDate, setEntryDate] = useState<number>(() =>
    Math.floor(Date.now() / 1000)
  );

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    const label = TYPE_LABEL[type || ""] || "";
    setPageTitle(isNew ? (label ? `新建${label}` : "新建") : "编辑");
  }, [type, isNew]);

  useEffect(() => {
    if (isNew || !id) {
      setLoaded(true);
      return;
    }
    const targetType = type === "memo" ? "memo" as const : "entry" as const;

    Promise.all([
      fetchEntry(id),
      // 加载边注以便保存时重算位置
      fetchComments(targetType, id).catch(() => ({ bottom: [], inline: [] })),
    ])
      .then(([entry, commentGroups]) => {
        const sessionAuthor = session?.user?.name ?? null;
        const contentType = entry.type || type || "";
        if (!canEditContent(contentType, entry.author, sessionAuthor)) {
          toast.error("无权编辑此内容");
          navigate(`/${type}/${id}`, { replace: true });
          return;
        }
        setTitle(entry.title || "");
        setBody(entry.body);
        setEntryAuthor(entry.author);
        if (entry.entryDate) setEntryDate(entry.entryDate);
        inlineCommentsRef.current = commentGroups.inline;
        setLoaded(true);
      })
      .catch((err) => {
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载失败，内容可能不存在"));
        }
        setLoaded(true);
      });
  }, [id, isNew, toast, type, navigate, session?.user?.name]);

  const handleEditorCreate = (editor: Editor) => {
    editorRef.current = editor;
  };

  const handleSave = async () => {
    if (!displayAuthor) {
      toast.error("无法识别作者身份，请使用「小圆子」或「小麟子」账号登录");
      return;
    }
    if (isEmptyBody(bodyRef.current)) {
      toast.error("内容不能为空");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const result = await createEntry({
          type: type === "diary" ? "diary"
            : type === "timeline" ? "timeline"
            : type === "message" ? "message"
            : type === "memo" ? "memo"
            : "letter",
          title,
          body: bodyRef.current,
          entryDate: isMemo ? undefined : entryDate,
        });
        if (!result?.id) {
          toast.error("创建失败：服务器未返回有效内容 ID");
          return;
        }
        toast.success("已创建");
        navigate(`/${type}/${result.id}`, { replace: true });
      } else {
        // 边注位置重映射：用混合锚定算法重新查找每个边注的位置
        let commentMappings: CommentPositionMapping[] | undefined;
        const editor = editorRef.current;
        const comments = inlineCommentsRef.current;
        if (editor && comments.length > 0) {
          try {
            commentMappings = comments
              .map((c) => {
                const resolved = resolveCommentPosition(editor, {
                  anchorFrom: c.anchorFrom,
                  anchorTo: c.anchorTo,
                  quote: c.quote,
                  anchorPrefix: c.anchorPrefix,
                  anchorSuffix: c.anchorSuffix,
                });
                if (!resolved) return null;
                // 仅记录实际发生变化的位置
                if (
                  resolved.from === c.anchorFrom &&
                  resolved.to === c.anchorTo
                ) {
                  return null;
                }
                return {
                  id: c.id,
                  anchorFrom: resolved.from,
                  anchorTo: resolved.to,
                };
              })
              .filter((m): m is CommentPositionMapping => m !== null);

            if (commentMappings.length === 0) {
              commentMappings = undefined;
            }
          } catch (err) {
            console.warn("[anchor] 位置重算失败，跳过", err);
            commentMappings = undefined;
          }
        }

        await saveEntry(id!, {
          title,
          body: bodyRef.current,
          entryDate: isMemo ? undefined : entryDate,
          commentMappings,
        });

        if (commentMappings && commentMappings.length > 0) {
          console.debug(
            `[anchor] 保存时重映射了 ${commentMappings.length} 个边注位置`
          );
        }

        toast.success("已保存");
        navigate(`/${type}/${id}`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!isNew && id) {
      navigate(`/${type}/${id}`);
      return;
    }
    if (type) {
      navigate(`/${type}`);
      return;
    }
    navigate(-1);
  };

  if (!loaded) return <p className="orbit-muted">加载中…</p>;

  return (
    <div className="orbit-editor-layout">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="orbit-page-title">
            {isNew ? `新建${TYPE_LABEL[type || ""] || ""}` : "编辑"}
          </h2>
          {displayAuthor && (
            <p className="orbit-entry-date mt-1">
              作者：{displayAuthor}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="orbit-btn"
            aria-label="关闭"
            title="关闭"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            关闭
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="orbit-btn orbit-btn-primary"
          >
            {saving ? "保存中…" : "保存"}
          </button>
        </div>
      </div>

      {/* 标题输入 */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
        className="orbit-title-input"
      />

      {!isMemo && (
        <div className="orbit-form-row">
          <label htmlFor="entry-date" className="orbit-form-label">
            日期
          </label>
          <input
            id="entry-date"
            type="date"
            value={toDateInput(entryDate)}
            onChange={(e) => setEntryDate(fromDateInput(e.target.value))}
            className="orbit-input-date"
          />
        </div>
      )}

      <TiptapEditor
        defaultValue={body}
        onChange={(val) => { bodyRef.current = val; }}
        entryId={isNew ? undefined : id}
        onEditorCreate={isNew ? undefined : handleEditorCreate}
      />
    </div>
  );
}
