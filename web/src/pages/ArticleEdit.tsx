import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { authClient, fetchEntry, saveEntry, createEntry, fetchComments, TYPE_LABEL, formatDate, getApiErrorMessage, shouldToastApiError, type CommentItem, type CommentPositionMapping, type EntryDetail } from "../lib/api";
import { getThreadRootId } from "../lib/letterThread";
import { resolveCommentPosition } from "../lib/anchor";
import { isEmptyBody } from "../lib/content";
import { setPageTitle } from "../lib/pageTitle";
import { resolveEditorAuthor } from "../lib/authors";
import { canEditContent } from "../lib/contentPolicies";
import { useToast } from "../lib/useToast";
import { TiptapEditor, type TiptapEditorHandle } from "../components/TiptapEditor";
import { EditorFullscreenOverlay } from "../components/EditorFullscreenOverlay";
import { DatePicker } from "../components/DatePicker";
import { CloseIcon } from "../components/OrbitIcons";
import { fromDateInput, toDateInput } from "../lib/dateInput";
import { anchorLogger } from "../lib/logger";
import { queryKeys } from "../lib/queryKeys";
import type { EditorHandoffState } from "../lib/editor-handoff";

export function ArticleEdit() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isNew = !id || id === "new" || id === "undefined";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [entryAuthor, setEntryAuthor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenHandoff, setFullscreenHandoff] = useState<EditorHandoffState | null>(null);
  const bodyRef = useRef(body);
  const inlineCommentsRef = useRef<CommentItem[]>([]);
  const editorRef = useRef<TiptapEditorHandle>(null);
  const displayAuthor = resolveEditorAuthor(entryAuthor, session?.user?.name);
  const isMemo = type === "memo";
  const [entryDate, setEntryDate] = useState<number>(() =>
    Math.floor(Date.now() / 1000)
  );
  const replyToParam = searchParams.get("replyTo");
  const isLetterReply = isNew && type === "letter" && Boolean(replyToParam);
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyContext, setReplyContext] = useState<EntryDetail | null>(null);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    const label = TYPE_LABEL[type || ""] || "";
    if (isLetterReply) {
      setPageTitle("写回信");
      return;
    }
    setPageTitle(isNew ? (label ? `新建${label}` : "新建") : "编辑");
  }, [type, isNew, isLetterReply]);

  useEffect(() => {
    if (!isLetterReply || !replyToParam) {
      setReplyParentId(null);
      setReplyContext(null);
      return;
    }

    let cancelled = false;
    fetchEntry(replyToParam)
      .then(async (target) => {
        if (cancelled) return;
        const rootId = getThreadRootId(target);
        const root =
          target.parentId != null ? await fetchEntry(target.parentId) : target;
        if (cancelled) return;
        setReplyParentId(rootId);
        setReplyContext(root);
      })
      .catch((err) => {
        if (!cancelled && shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "找不到要回复的信件"));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLetterReply, replyToParam, toast]);

  useEffect(() => {
    if (isNew || !id) {
      setLoaded(true);
      return;
    }
    const targetType = type === "memo" ? "memo" as const : "entry" as const;

    Promise.all([
      fetchEntry(id),
      fetchComments(targetType, id).catch(() => ({ bottom: [], inline: [] })),
    ])
      .then(([entry, commentGroups]) => {
        const sessionUserId = session?.user?.id ?? null;
        const contentType = entry.type || type || "";
        if (!canEditContent(contentType, entry.userId, sessionUserId)) {
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
  }, [id, isNew, toast, type, navigate, session?.user?.id]);

  const applyFullscreenClose = useCallback((detail: {
    html: string;
    title: string;
    selection: EditorHandoffState["selection"];
    json: EditorHandoffState["json"];
  }) => {
    bodyRef.current = detail.html;
    setBody(detail.html);
    setTitle(detail.title);
    setFullscreenOpen(false);
    setFullscreenHandoff(null);
    requestAnimationFrame(() => {
      editorRef.current?.setEditorState(detail.json, detail.selection);
      editorRef.current?.focusSelection(detail.selection);
    });
  }, []);

  const handleOpenFullscreen = useCallback(() => {
    const state = editorRef.current?.getEditorState();
    if (!state) return;
    setFullscreenHandoff(state);
    setFullscreenOpen(true);
  }, []);

  const handleFullscreenClose = useCallback((detail: Parameters<typeof applyFullscreenClose>[0]) => {
    applyFullscreenClose(detail);
  }, [applyFullscreenClose]);

  const handleSave = async () => {
    if (!displayAuthor) {
      toast.error("无法识别作者身份，请重新登录");
      return;
    }
    if (isEmptyBody(bodyRef.current)) {
      toast.error("内容不能为空");
      return;
    }
    if (isLetterReply && !replyParentId) {
      toast.error("找不到要回复的信件");
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
          parentId: isLetterReply ? replyParentId : undefined,
        });
        if (!result?.id) {
          toast.error("创建失败：服务器未返回有效内容 ID");
          return;
        }
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["entries"] }),
          queryClient.invalidateQueries({ queryKey: ["gallery"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.memorySummary }),
          queryClient.invalidateQueries({ queryKey: ["memory-nodes"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.activityStats(365) }),
        ]);
        toast.success("已创建");
        navigate(`/${type}/${result.id}`, { replace: true });
      } else {
        let commentMappings: CommentPositionMapping[] | undefined;
        const editor = editorRef.current?.getEditor();
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
            anchorLogger.warn("remap positions failed, skipped", {
              error: err instanceof Error ? err.message : String(err),
            });
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
          anchorLogger.debug("remapped inline comment positions on save", {
            count: commentMappings.length,
          });
        }

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["entries"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.entry(id!) }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.comments(isMemo ? "memo" : "entry", id!),
          }),
          queryClient.invalidateQueries({ queryKey: ["gallery"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.memorySummary }),
          queryClient.invalidateQueries({ queryKey: ["memory-nodes"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.activityStats(365) }),
        ]);

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
    <>
      <div className="orbit-editor-layout">
        <div className="flex items-center justify-between mb-6 gap-4">
          <div>
            <h2 className="orbit-page-title">
              {isLetterReply
                ? "写回信"
                : isNew
                  ? `新建${TYPE_LABEL[type || ""] || ""}`
                  : "编辑"}
            </h2>
            {isLetterReply && replyContext && (
              <p className="orbit-letter-reply-context">
                回复 {replyContext.author ?? "对方"} 的信
                {replyContext.entryDate
                  ? ` · ${formatDate(replyContext.entryDate)}`
                  : ""}
              </p>
            )}
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
              <CloseIcon />
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

        {!isMemo && (
          <div className="orbit-form-row">
            <label htmlFor="entry-date" className="orbit-form-label">
              日期
            </label>
            <DatePicker
              id="entry-date"
              value={toDateInput(entryDate)}
              onChange={(value) => setEntryDate(fromDateInput(value))}
              aria-label="选择日期"
            />
          </div>
        )}

        <TiptapEditor
          ref={editorRef}
          defaultValue={body}
          onChange={(val) => { bodyRef.current = val; }}
          entryId={isNew ? undefined : id}
          mode="note"
          onToggleMode={handleOpenFullscreen}
        />
      </div>

      <EditorFullscreenOverlay
        open={fullscreenOpen}
        title={title}
        handoff={fullscreenHandoff}
        entryId={isNew ? undefined : id}
        saving={saving}
        onClose={handleFullscreenClose}
        onSave={(detail) => {
          applyFullscreenClose(detail);
          void handleSave();
        }}
        onDismiss={handleClose}
      />
    </>
  );
}
