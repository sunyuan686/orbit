import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { CloseIcon, DraftBoxIcon } from "../components/OrbitIcons";
import { fromDateInput, toDateInput } from "../lib/dateInput";
import { anchorLogger } from "../lib/logger";
import { queryKeys } from "../lib/queryKeys";
import type { EditorHandoffState } from "../lib/editor-handoff";
import { DraftDrawer } from "../components/DraftDrawer";
import { ActionSheetDialog } from "../components/ActionSheetDialog";
import { useDrafts } from "../lib/useDrafts";

/**
 * ArticleEdit 的路由结构：/:type/:id/edit 或 /:type/new/edit
 *
 * 第一性原理：当 id 改变时（从草稿箱打开草稿），我们用 key={id} 强制
 * 父组件重建 ArticleEditInner，使所有 useState 以新 id 对应的数据为初始值。
 * 这完全消除了 useEffect 同步 server state → local state 的反模式。
 */
export function ArticleEdit() {
  const { type, id } = useParams<{ type: string; id: string }>();
  return <ArticleEditInner key={id || "new"} type={type ?? ""} id={id} />;
}

interface ArticleEditInnerProps {
  type: string;
  id: string | undefined;
}

function ArticleEditInner({ type, id }: ArticleEditInnerProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isNew = !id || id === "new" || id === "undefined";

  const { count: draftCount, invalidate: invalidateDrafts } = useDrafts(type);

  // ── Server data (via React Query) ────────────────────────────────────────
  // 注意：此处用独立的 ["entry-edit", id] 作为 key，不共用 queryKeys.entry(id)。
  // 原因：ArticleEdit 缓存的是 { entry, commentGroups } 包装对象，
  // 而 ArticleView 的 queryKeys.entry(id) 期望得到的是裸的 EntryDetail。
  // 共用同一 key 会导致 ArticleView 从缓存读到包装对象，进而 entry.body === undefined。
  const {
    data: entryData,
    isError: entryIsError,
    isFetching,
  } = useQuery({
    queryKey: ["entry-edit", id ?? ""],
    queryFn: async () => {
      const targetType = type === "memo" ? ("memo" as const) : ("entry" as const);
      const [entry, commentGroups] = await Promise.all([
        fetchEntry(id!),
        fetchComments(targetType, id!).catch(() => ({ bottom: [], inline: [] })),
      ]);
      return { entry, commentGroups };
    },
    enabled: !isNew && Boolean(id),
    retry: false,
    staleTime: 0,
  });

  // 从 server data 派生初始值（key={id} 保证每次 id 变化时组件重建，useState 初始值天然正确）
  const serverEntry = entryData?.entry ?? null;
  const serverComments = entryData?.commentGroups ?? null;

  // 权限检查
  useEffect(() => {
    if (!serverEntry) return;
    const sessionUserId = session?.user?.id ?? null;
    const contentType = serverEntry.type || type || "";
    if (!canEditContent(contentType, serverEntry.userId, sessionUserId)) {
      toast.error("无权编辑此内容");
      navigate(`/${type}/${id}`, { replace: true });
    }
  }, [serverEntry, session?.user?.id, type, id, navigate, toast]);

  // 404 / 已删除：自动重置为新建
  useEffect(() => {
    if (!isNew && entryIsError) {
      toast.error("当前编辑的内容不存在或已被删除");
      navigate(`/${type}/new/edit`, { replace: true });
    }
  }, [entryIsError, isNew, navigate, type, toast]);

  // ── Local editor state ────────────────────────────────────────────────────
  // 初始值直接从 serverEntry 读取（组件通过 key={id} 重建时 serverEntry 为 null，待 query 返回后 useEffect 注入内容）
  const [title, setTitle] = useState(serverEntry?.title ?? "");
  const [showTitle, setShowTitle] = useState(Boolean(serverEntry?.title?.trim()));
  const [body, setBody] = useState(serverEntry?.body ?? "");
  const [entryAuthor, setEntryAuthor] = useState<string | null>(serverEntry?.author ?? null);
  const [isDraft, setIsDraft] = useState(serverEntry?.status === "draft");
  const [entryDate, setEntryDate] = useState<number>(() =>
    serverEntry?.entryDate ?? Math.floor(Date.now() / 1000)
  );

  const bodyRef = useRef(body);
  const inlineCommentsRef = useRef<CommentItem[]>(serverComments?.inline ?? []);
  const editorRef = useRef<TiptapEditorHandle>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // 当 query 首次返回数据时（key 重建后组件挂载时 serverEntry 尚未就绪），注入编辑器内容
  const injectedRef = useRef(false);
  useEffect(() => {
    if (!serverEntry || injectedRef.current) return;
    injectedRef.current = true;
    setTitle(serverEntry.title ?? "");
    setShowTitle(Boolean(serverEntry.title?.trim()));
    setBody(serverEntry.body ?? "");
    bodyRef.current = serverEntry.body ?? "";
    setEntryAuthor(serverEntry.author ?? null);
    setIsDraft(serverEntry.status === "draft");
    if (serverEntry.entryDate) setEntryDate(serverEntry.entryDate);
    inlineCommentsRef.current = serverComments?.inline ?? [];

    // 等 TiptapEditor 挂载后注入内容
    setTimeout(() => {
      const editor = editorRef.current?.getEditor();
      if (editor && !editor.isDestroyed) {
        editor.commands.setContent(serverEntry.body || "");
      }
    }, 0);
  }, [serverEntry, serverComments]);

  // ── Misc hooks ────────────────────────────────────────────────────────────
  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    const label = TYPE_LABEL[type || ""] || "";
    const isLetterReply = isNew && type === "letter" && Boolean(searchParams.get("replyTo"));
    if (isLetterReply) {
      setPageTitle("写回信");
      return;
    }
    setPageTitle(isNew ? (label ? `新建${label}` : "新建") : "编辑");
  }, [type, isNew, searchParams]);

  const replyToParam = searchParams.get("replyTo");
  const isLetterReply = isNew && type === "letter" && Boolean(replyToParam);
  const [replyParentId, setReplyParentId] = useState<string | null>(null);
  const [replyContext, setReplyContext] = useState<EntryDetail | null>(null);

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

  // ── Derived ───────────────────────────────────────────────────────────────
  const displayAuthor = resolveEditorAuthor(entryAuthor, session?.user?.name);
  const isMemo = type === "memo";

  // 加载状态：新建立即 ready，编辑时等待 server data
  const loaded = isNew || Boolean(serverEntry) || entryIsError;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenHandoff, setFullscreenHandoff] = useState<EditorHandoffState | null>(null);
  const [draftDrawerOpen, setDraftDrawerOpen] = useState(false);
  /** 关闭时「保存草稿？」弹窗 */
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  /** 草稿图标二次确认弹窗 */
  const [showSaveDraftDialog, setShowSaveDraftDialog] = useState(false);

  // ── Actions ───────────────────────────────────────────────────────────────
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
          status: "published",
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
      } else if (isDraft) {
        const updatedDetail = await saveEntry(id!, {
          title,
          body: bodyRef.current,
          entryDate: isMemo ? undefined : entryDate,
          status: "published",
        });
        queryClient.setQueryData(queryKeys.entry(id!), updatedDetail);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["entries"] }),
          queryClient.invalidateQueries({ queryKey: ["gallery"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.memorySummary }),
          queryClient.invalidateQueries({ queryKey: ["memory-nodes"] }),
          queryClient.invalidateQueries({ queryKey: ["activity-stats"] }),
          invalidateDrafts(),
        ]);
        toast.success("已发布");
        navigate(`/${type}/${id}`, { replace: true });
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

        const updatedDetail = await saveEntry(id!, {
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

        queryClient.setQueryData(queryKeys.entry(id!), updatedDetail);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["entries"] }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.comments(isMemo ? "memo" : "entry", id!),
          }),
          queryClient.invalidateQueries({ queryKey: ["gallery"] }),
          queryClient.invalidateQueries({ queryKey: queryKeys.memorySummary }),
          queryClient.invalidateQueries({ queryKey: ["memory-nodes"] }),
          queryClient.invalidateQueries({ queryKey: ["activity-stats"] }),
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

  const doClose = useCallback(() => {
    if (!isNew && id) {
      navigate(`/${type}/${id}`);
      return;
    }
    if (type) {
      navigate(`/${type}`);
      return;
    }
    navigate(-1);
  }, [isNew, id, type, navigate]);

  const checkHasContent = useCallback(() => {
    const currentBody = editorRef.current?.getEditor()?.getHTML() || bodyRef.current || body;
    return !isEmptyBody(currentBody) || Boolean(title.trim());
  }, [body, title]);

  const doSaveDraft = useCallback(async (opts?: { thenOpenDrawer?: boolean; thenClose?: boolean }) => {
    if (!type) return;
    const hasText = checkHasContent();
    if (!hasText && !isDraft) {
      if (opts?.thenOpenDrawer) setDraftDrawerOpen(true);
      return;
    }

    setSavingDraft(true);
    try {
      if (isNew) {
        const result = await createEntry({
          type: type === "diary" ? "diary"
            : type === "timeline" ? "timeline"
            : type === "message" ? "message"
            : type === "memo" ? "memo"
            : "letter",
          title,
          body: bodyRef.current || undefined,
          entryDate: isMemo ? undefined : entryDate,
          status: "draft",
        });
        if (!result?.id) {
          toast.error("草稿保存失败");
          return;
        }
      } else {
        await saveEntry(id!, {
          title,
          body: bodyRef.current || undefined,
          entryDate: isMemo ? undefined : entryDate,
          status: "draft",
        });
      }
      await invalidateDrafts();
      toast.success("草稿已保存");

      setTitle("");
      setShowTitle(false);
      setBody("");
      bodyRef.current = "";
      editorRef.current?.getEditor()?.commands.setContent("");
      setIsDraft(false);

      if (opts?.thenClose) {
        doClose();
        return;
      }
      navigate(`/${type}/new/edit`, { replace: true });
      if (opts?.thenOpenDrawer) setDraftDrawerOpen(true);
    } catch (err) {
      toast.error(getApiErrorMessage(err, "草稿保存失败"));
    } finally {
      setSavingDraft(false);
    }
  }, [type, checkHasContent, isDraft, isNew, id, title, isMemo, entryDate, navigate, toast, invalidateDrafts, doClose]);

  const handleClose = useCallback(() => {
    if (checkHasContent() || isDraft) {
      setShowCloseDialog(true);
      return;
    }
    doClose();
  }, [checkHasContent, isDraft, doClose]);

  const handleDraftIconClick = useCallback(() => {
    if (!type) return;
    const hasText = checkHasContent();
    if (hasText || isDraft) {
      // 有内容：先弹二次确认
      setShowSaveDraftDialog(true);
    } else {
      // 无内容：直接打开草稿箱
      setDraftDrawerOpen(true);
    }
  }, [type, checkHasContent, isDraft]);

  const hasContent = checkHasContent();

  if (!loaded || isFetching && !serverEntry) return <p className="orbit-muted">加载中…</p>;

  return (
    <>
      <div className="orbit-editor-layout">
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex items-center flex-wrap gap-2 text-xs orbit-editor-meta-bar">
            {!isNew && (
              <span className="orbit-page-title-badge">
                {isDraft ? "编辑草稿" : "编辑"}
              </span>
            )}
            {isLetterReply && replyContext && (
              <span className="orbit-letter-reply-context">
                回复 {replyContext.author ?? "对方"} 的信
                {replyContext.entryDate
                  ? ` · ${formatDate(replyContext.entryDate)}`
                  : ""}
              </span>
            )}
            {displayAuthor && (
              <span className="orbit-entry-author">
                作者：{displayAuthor}
              </span>
            )}
            {!isMemo && (
              <>
                <span className="orbit-meta-divider">•</span>
                <DatePicker
                  id="entry-date"
                  value={toDateInput(entryDate)}
                  onChange={(value) => setEntryDate(fromDateInput(value))}
                  variant="inline"
                  aria-label="选择日期"
                />
              </>
            )}
            {isDraft && (
              <>
                <span className="orbit-meta-divider">•</span>
                <span className="orbit-draft-label">草稿</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              className="orbit-btn orbit-btn-sm orbit-btn-ghost"
              aria-label="关闭"
              title="关闭"
            >
              <CloseIcon size="sm" />
              <span className="hidden sm:inline">关闭</span>
            </button>
            {/* 1:1 复刻 Jant：点击图标在有内容时存草稿+清空+开草稿箱，无内容时直接开草稿箱 */}
            <button
              type="button"
              onClick={() => void handleDraftIconClick()}
              disabled={savingDraft}
              className="orbit-draft-icon-btn orbit-btn orbit-btn-sm orbit-btn-ghost"
              aria-label="草稿箱"
              title={hasContent || isDraft ? "保存草稿并打开草稿箱" : "查看草稿箱"}
            >
              <DraftBoxIcon size="sm" />
              {draftCount > 0 && (
                <span className="orbit-draft-count-badge orbit-draft-count-badge--overlay">{draftCount}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="orbit-btn orbit-btn-sm orbit-btn-primary"
            >
              {saving ? "保存中…" : isDraft ? "发布" : "保存"}
            </button>
          </div>
        </div>

        {showTitle && (
          <div className="orbit-form-row mb-3">
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="添加标题…"
              className="orbit-compose-title-input"
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
          showTitle={showTitle}
          onToggleTitle={() => {
            const willShow = !showTitle;
            setShowTitle(willShow);
            if (willShow) {
              requestAnimationFrame(() => {
                titleInputRef.current?.focus();
              });
            }
          }}
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

      <DraftDrawer
        open={draftDrawerOpen}
        onClose={() => setDraftDrawerOpen(false)}
        type={type ?? ""}
      />

      {/* 关闭时「是否保存草稿？」三选一弹窗，对齐 Jant */}
      <ActionSheetDialog
        open={showCloseDialog}
        title="保存到草稿？"
        description="保存草稿，之后可以继续编辑和发布。"
        onDismiss={() => setShowCloseDialog(false)}
        actions={[
          {
            label: "保存",
            bold: true,
            onClick: () => {
              setShowCloseDialog(false);
              void doSaveDraft({ thenClose: true });
            },
          },
          {
            label: "不保存",
            variant: "destructive",
            onClick: () => {
              setShowCloseDialog(false);
              doClose();
            },
          },
          {
            label: "取消",
            variant: "muted",
            onClick: () => setShowCloseDialog(false),
          },
        ]}
      />

      {/* 草稿图标点击时的二次确认弹窗 */}
      <ActionSheetDialog
        open={showSaveDraftDialog}
        title="保存到草稿箱？"
        description="当前内容将保存到草稿箱，可随时返回继续编辑。"
        onDismiss={() => setShowSaveDraftDialog(false)}
        actions={[
          {
            label: "保存",
            bold: true,
            onClick: () => {
              setShowSaveDraftDialog(false);
              void doSaveDraft({ thenOpenDrawer: true });
            },
          },
          {
            label: "取消",
            variant: "muted",
            onClick: () => setShowSaveDraftDialog(false),
          },
        ]}
      />
    </>
  );
}
