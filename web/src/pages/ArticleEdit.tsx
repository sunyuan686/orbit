import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams, useLocation, useBlocker, type Location } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authClient, fetchEntry, saveEntry, createEntry, deleteEntry, fetchComments, TYPE_LABEL, formatDate, getApiErrorMessage, shouldToastApiError, type CommentItem, type CommentPositionMapping, type EntryDetail } from "../lib/api";
import { resolveEntryType, canEditContent } from "@orbit/shared";
import { getThreadRootId } from "../lib/letterThread";
import { resolveCommentPosition } from "../lib/anchor";
import { isEmptyBody } from "../lib/content";
import { setPageTitle } from "../lib/pageTitle";
import { resolveEditorAuthor } from "../lib/authors";
import { useToast } from "../hooks/useToast";
import { useLayer } from "../hooks/useLayer";
import { sameUrl } from "../lib/layers";
import { TiptapEditor, type TiptapEditorHandle } from "../components/TiptapEditor";
import { EditorFullscreenOverlay } from "../components/EditorFullscreenOverlay";
import { DatePicker } from "../components/DatePicker";
import { BackIcon, DraftBoxIcon } from "../components/OrbitIcons";
import { fromDateInput, toDateInput } from "../lib/dateInput";
import { anchorLogger } from "../lib/logger";
import { queryKeys } from "../lib/queryKeys";
import type { EditorHandoffState } from "../lib/editor-handoff";
import { ActionSheetDialog } from "../components/ActionSheetDialog";
import { useDrafts } from "../hooks/useDrafts";
import { useMomentTags } from "../hooks/useMomentTags";
import { TagManageModal } from "../components/moment/TagManageModal";
import { Container, FilterChipDropdown } from "../components/ui";

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

function formatDraftTime(ts?: number): string {
  if (!ts) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = now - ts;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return formatDate(ts);
}

interface ArticleEditInnerProps {
  type: string;
  id: string | undefined;
}

function ArticleEditInner({ type, id }: ArticleEditInnerProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { initialBody?: string; initialTag?: string | null } | null;
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: session } = authClient.useSession();
  const isNew = !id || id === "new" || id === "undefined";

  const { latestDraft, invalidate: invalidateDrafts } = useDrafts(type);
  const [draftDismissed, setDraftDismissed] = useState(false);

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
      const targetType = "entry" as const;
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
  // 初始值直接从 serverEntry 或跳转携带的 navState 读取
  const [title, setTitle] = useState(serverEntry?.title ?? "");
  const [showTitle, setShowTitle] = useState(Boolean(serverEntry?.title?.trim()));
  const [body, setBody] = useState(isNew ? (navState?.initialBody ?? "") : (serverEntry?.body ?? ""));
  const [entryAuthor, setEntryAuthor] = useState<string | null>(serverEntry?.author ?? null);
  const [isDraft, setIsDraft] = useState(serverEntry?.status === "draft");
  const [entryDate, setEntryDate] = useState<number>(() =>
    serverEntry?.entryDate ?? Math.floor(Date.now() / 1000)
  );
  const [tag, setTag] = useState<string | null>(isNew ? (navState?.initialTag ?? null) : (serverEntry?.tag ?? null));
  const { tags } = useMomentTags();
  const {
    isOpen: tagManageOpen,
    open: openTagManage,
    close: closeTagManage,
  } = useLayer("tags-edit");

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
    setTag(serverEntry.tag ?? null);
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

  // 加载状态：新建立即 ready，编辑时等待 server data
  const loaded = isNew || Boolean(serverEntry) || entryIsError;

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const {
    isOpen: fullscreenOpen,
    open: openFullscreen,
    close: closeFullscreen,
    replaceWith: replaceFullscreenWith,
  } = useLayer("editor-fullscreen");
  const [fullscreenHandoff, setFullscreenHandoff] = useState<EditorHandoffState | null>(null);
  /** 关闭时「保存草稿？」弹窗 */
  const {
    isOpen: showCloseDialog,
    open: openDraftPrompt,
    close: closeDraftPrompt,
  } = useLayer("draft-prompt");

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
    openFullscreen();
  }, [openFullscreen]);

  // 只回填编辑器状态；是否关闭全屏层由各调用方决定（见下方 onSave / onDismiss 的注释）。
  const handleFullscreenClose = useCallback((detail: Parameters<typeof applyFullscreenClose>[0]) => {
    applyFullscreenClose(detail);
    closeFullscreen();
  }, [applyFullscreenClose, closeFullscreen]);

  const isSubmittingRef = useRef(false);

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
    isSubmittingRef.current = true;
    try {
      if (isNew) {
        const result = await createEntry({
          type: resolveEntryType(type, "moment"),
          title,
          body: bodyRef.current,
          entryDate,
          parentId: isLetterReply ? replyParentId : undefined,
          status: "published",
          tag: type === "moment" ? tag : undefined,
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
          entryDate,
          status: "published",
          tag: type === "moment" ? tag : undefined,
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
          entryDate,
          commentMappings,
          tag: type === "moment" ? tag : undefined,
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
            queryKey: queryKeys.comments("entry", id!),
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
      isSubmittingRef.current = false;
      toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
    } finally {
      setSaving(false);
    }
  };

  const doClose = useCallback(() => {
    // 显式目的路由 + replace：编辑器是从详情页/列表页进入的一次性页面，不该留在前进栈里
    // （否则从详情页再返回会重新进入编辑器）；同时也让「保存草稿？」层条目被就地替换掉。
    if (!isNew && id) {
      navigate(`/${type}/${id}`, { replace: true });
      return;
    }
    if (type) {
      navigate(`/${type}`, { replace: true });
      return;
    }
    navigate(-1);
  }, [isNew, id, type, navigate]);

  const checkHasContent = useCallback(() => {
    const currentBody = editorRef.current?.getEditor()?.getHTML() || bodyRef.current || body;
    return !isEmptyBody(currentBody) || Boolean(title.trim());
  }, [body, title]);

  const saveDraftContent = useCallback(async (): Promise<boolean> => {
    if (!type) return false;
    const hasText = checkHasContent();
    if (!hasText && !isDraft) {
      return true;
    }

    try {
      if (isNew) {
        const result = await createEntry({
          type: resolveEntryType(type, "moment"),
          title,
          body: bodyRef.current || undefined,
          entryDate,
          status: "draft",
          tag: type === "moment" ? tag : undefined,
        });
        if (!result?.id) {
          toast.error("草稿保存失败");
          return false;
        }
      } else {
        await saveEntry(id!, {
          title,
          body: bodyRef.current || undefined,
          entryDate,
          status: "draft",
          tag: type === "moment" ? tag : undefined,
        });
      }
      await invalidateDrafts();
      toast.success("草稿已保存");
      return true;
    } catch (err) {
      toast.error(getApiErrorMessage(err, "草稿保存失败"));
      return false;
    }
  }, [type, checkHasContent, isDraft, isNew, id, title, entryDate, toast, invalidateDrafts, tag]);

  const needsDraftPrompt = useCallback(
    () => checkHasContent() || isDraft,
    [checkHasContent, isDraft],
  );

  const shouldBlock = useCallback(
    ({ currentLocation, nextLocation }: { currentLocation: Location; nextLocation: Location }) => {
      if (isSubmittingRef.current) return false;
      if (sameUrl(currentLocation) === sameUrl(nextLocation)) return false;
      return needsDraftPrompt();
    },
    [needsDraftPrompt],
  );

  const blocker = useBlocker(shouldBlock);

  const isPromptOpen = showCloseDialog || blocker.state === "blocked";

  const handlePromptSave = useCallback(async () => {
    isSubmittingRef.current = true;
    const saved = await saveDraftContent();
    if (!saved) {
      isSubmittingRef.current = false;
      return;
    }
    if (blocker.state === "blocked") {
      blocker.proceed();
    } else {
      closeDraftPrompt();
      doClose();
    }
  }, [saveDraftContent, blocker, closeDraftPrompt, doClose]);

  const handlePromptDiscard = useCallback(() => {
    isSubmittingRef.current = true;
    if (blocker.state === "blocked") {
      blocker.proceed();
    } else {
      closeDraftPrompt();
      doClose();
    }
  }, [blocker, closeDraftPrompt, doClose]);

  const handlePromptCancel = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.reset();
    } else {
      closeDraftPrompt();
    }
  }, [blocker, closeDraftPrompt]);

  const handleClose = useCallback(() => {
    if (needsDraftPrompt()) {
      openDraftPrompt();
      return;
    }
    doClose();
  }, [needsDraftPrompt, doClose, openDraftPrompt]);

  const handleRestoreDraft = useCallback(() => {
    if (!latestDraft) return;
    isSubmittingRef.current = true;
    navigate(`/${type}/${latestDraft.id}/edit`, { replace: true });
  }, [latestDraft, type, navigate]);

  const handleDiscardDraft = useCallback(async () => {
    if (!latestDraft) return;
    try {
      await deleteEntry(latestDraft.id);
      await invalidateDrafts();
      setDraftDismissed(true);
      toast.success("草稿已丢弃");
    } catch (err) {
      toast.error(getApiErrorMessage(err, "丢弃草稿失败"));
    }
  }, [latestDraft, invalidateDrafts, toast]);

  const hasContent = checkHasContent();
  const showDraftPrompt = isNew && !draftDismissed && Boolean(latestDraft) && !hasContent;

  if (!loaded || isFetching && !serverEntry) return <p className="orbit-muted">加载中…</p>;

  return (
    <>
      <Container size="narrow" className="orbit-editor-layout">
        {/* 顶部导航控制栏：只保留返回按钮与保存/发布主操作 */}
        <div className="orbit-editor-header flex items-center justify-between mb-3 gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="orbit-icon-btn orbit-icon-btn--sm"
              aria-label="返回"
              title="返回"
            >
              <BackIcon size="sm" />
            </button>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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

        {/* 单草稿按需唤醒条幅：仅在空白新建且存在草稿时温和提示 */}
        {showDraftPrompt && latestDraft && (
          <div className="orbit-draft-restore-banner flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--color-surface-raised)] border border-[var(--color-border-light)] text-xs text-[var(--color-text-secondary)] mb-3">
            <div className="flex items-center gap-2 min-w-0 mr-3">
              <DraftBoxIcon size="sm" className="shrink-0 text-[var(--color-text-secondary)]" />
              <span className="truncate">
                检测到上次未完成的{type === "letter" ? "信件" : "动态"}草稿
                {latestDraft.updatedAt ? `（${formatDraftTime(latestDraft.updatedAt)}）` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleRestoreDraft}
                className="font-medium text-[var(--color-primary)] hover:underline cursor-pointer"
              >
                恢复
              </button>
              <span className="text-[var(--color-border-light)] select-none">|</span>
              <button
                type="button"
                onClick={() => void handleDiscardDraft()}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-pointer"
              >
                丢弃
              </button>
            </div>
          </div>
        )}

        {/* 内联元信息栏：作者、日期、回复上下文下沉至正文头部展示，解决顶栏拥挤重叠 */}
        <div className="flex items-center flex-wrap gap-2 text-xs orbit-editor-meta-bar mb-3">
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
          {displayAuthor && <span className="orbit-meta-divider">•</span>}
          <DatePicker
            id="entry-date"
            value={toDateInput(entryDate)}
            onChange={(value) => setEntryDate(fromDateInput(value))}
            variant="inline"
            aria-label="选择日期"
          />
          {isDraft && (
            <>
              <span className="orbit-meta-divider">•</span>
              <span className="orbit-draft-label">草稿</span>
            </>
          )}
          {type === "moment" && (
            <>
              <span className="orbit-meta-divider">•</span>
              <FilterChipDropdown
                label="# 标签"
                value={tag}
                variant="inline"
                allLabel="无标签"
                options={tags.map((item) => ({
                  value: item.id,
                  label: `# ${item.name}`,
                }))}
                onChange={(val) => setTag(val)}
                footerAction={{
                  label: "+ 管理标签",
                  onClick: openTagManage,
                }}
              />
            </>
          )}
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
      </Container>

      <EditorFullscreenOverlay
        open={fullscreenOpen}
        title={title}
        handoff={fullscreenHandoff}
        entryId={isNew ? undefined : id}
        saving={saving}
        onClose={handleFullscreenClose}
        onSave={(detail) => {
          handleFullscreenClose(detail);
          void handleSave();
        }}
        onDismiss={(detail) => {
          applyFullscreenClose(detail);
          // 退出全屏后若还需询问「保存到草稿？」，把询问就地替换为栈顶：
          // 写成「先关全屏层再压询问层」会让同一 tick 内的 go(-1) 与 pushState 互相打架
          // （前者异步、后者同步），结果是询问层刚压入就被回退弹掉。
          if (needsDraftPrompt()) replaceFullscreenWith("draft-prompt");
          else doClose();
        }}
      />

      {/* 关闭时「是否保存草稿？」三选一弹窗，对齐 Jant */}
      <ActionSheetDialog
        open={isPromptOpen}
        title="保存到草稿？"
        onDismiss={handlePromptCancel}
        actions={[
          {
            label: "保存",
            bold: true,
            onClick: () => {
              void handlePromptSave();
            },
          },
          {
            label: "不保存",
            variant: "destructive",
            onClick: handlePromptDiscard,
          },
          {
            label: "取消",
            variant: "muted",
            onClick: handlePromptCancel,
          },
        ]}
      />

      <TagManageModal
        isOpen={tagManageOpen}
        onClose={closeTagManage}
        onTagCreated={(newId) => setTag(newId)}
      />
    </>
  );
}
