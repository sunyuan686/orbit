import { useCallback, useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  authClient,
  createComment,
  deleteComment,
  deleteEntry,
  fetchComments,
  fetchEntry,
  formatDate,
  getApiErrorMessage,
  shouldToastApiError,
  TYPE_LABEL,
  type CommentGroups,
  type EntryDetail,
} from "../lib/api";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import { TiptapEditor } from "../components/TiptapEditor";
import { CommentSection } from "../components/CommentSection";
import { TableOfContents, MobileToc, extractToc } from "../components/TableOfContents";
import { getCommentCapabilities } from "../lib/commentCapabilities";

export function ArticleView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: session } = authClient.useSession();
  const [entry, setEntry] = useState<EntryDetail | null>(null);
  const [comments, setComments] = useState<CommentGroups>({ bottom: [], inline: [] });
  const [inlineDraft, setInlineDraft] = useState<{
    quote: string;
    anchorFrom: number;
    anchorTo: number;
    anchorPrefix: string;
    anchorSuffix: string;
  } | null>(null);
  const [activeInlineCommentId, setActiveInlineCommentId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const capabilities = getCommentCapabilities(entry?.type ?? type);
  const targetType = entry?.type === "memo" ? "memo" : "entry";
  // 当前登录作者，只取决于会话本身（user.name 即规范作者「小圆子/小麟子」）
  const currentAuthor = session?.user?.name ?? null;
  const canEditEntry = !!entry?.author && entry.author === currentAuthor;

  const loadComments = useCallback(
    async (targetId: string, nextTargetType: "entry" | "memo") => {
      const groups = await fetchComments(nextTargetType, targetId);
      setComments(groups);
    },
    []
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function loadEntry() {
      try {
        const nextEntry = await fetchEntry(id!);
        if (cancelled) return;

        setError(false);
        setEntry(nextEntry);
        setComments({ bottom: [], inline: [] });
        setPageTitle(nextEntry.title || TYPE_LABEL[type || ""] || "详情");

        try {
          await loadComments(nextEntry.id, nextEntry.type === "memo" ? "memo" : "entry");
        } catch (err) {
          if (!cancelled && shouldToastApiError(err)) {
            toast.error("评论加载失败");
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(true);
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载失败"));
        }
      }
    }

    void loadEntry();

    return () => {
      cancelled = true;
    };
  }, [id, loadComments, type, toast]);

  const toc = useMemo(
    () => (entry ? extractToc(entry.body) : []),
    [entry]
  );

  if (error) return <p style={{ color: "oklch(0.55 0.18 27)" }}>文章不存在</p>;
  if (!entry) return <p style={{ color: "var(--color-text-muted)" }}>加载中…</p>;

  async function refreshComments() {
    if (!entry) return;
    await loadComments(entry.id, targetType);
  }

  async function handleCreateBottom(body: string, parentId?: string | null) {
    if (!entry) return;
    try {
      await createComment({
        targetType,
        targetId: entry.id,
        kind: "bottom",
        body,
        parentId: parentId ?? null,
      });
      await refreshComments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "评论失败"));
    }
  }

  async function handleCreateInline(body: string) {
    if (!entry || !inlineDraft) return;
    try {
      const result = await createComment({
        targetType,
        targetId: entry.id,
        kind: "inline",
        body,
        quote: inlineDraft.quote,
        anchorFrom: inlineDraft.anchorFrom,
        anchorTo: inlineDraft.anchorTo,
        anchorPrefix: inlineDraft.anchorPrefix,
        anchorSuffix: inlineDraft.anchorSuffix,
      });
      setInlineDraft(null);
      setActiveInlineCommentId(result.id);
      await refreshComments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "添加边注失败"));
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteComment(commentId);
      if (activeInlineCommentId === commentId) setActiveInlineCommentId(null);
      await refreshComments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "删除评论失败"));
    }
  }

  async function handleDeleteArticle() {
    if (!entry) return;
    const confirmed = window.confirm("确定删除这条内容吗？删除后无法恢复。");
    if (!confirmed) return;
    try {
      await deleteEntry(entry.id);
      toast.success("已删除");
      navigate(type ? `/${type}` : "/", { replace: true });
    } catch (err) {
      toast.error(getApiErrorMessage(err, "删除失败"));
    }
  }

  return (
    <div className="flex gap-8" style={{ maxWidth: "900px", margin: "0 auto" }}>
      {/* 文章主体 */}
      <div className="flex-1 min-w-0" style={{ maxWidth: "680px" }}>
        <button
          type="button"
          onClick={() => (type ? navigate(`/${type}`) : navigate(-1))}
          className="orbit-btn mb-4"
          aria-label="返回列表"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          返回{TYPE_LABEL[type || ""] ? TYPE_LABEL[type || ""] : "列表"}
        </button>

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            {entry.title && (
              <h2 className="orbit-page-title" style={{ marginBottom: "0.25rem" }}>
                {entry.title}
              </h2>
            )}
            {entry.entryDate && (
              <p className="orbit-entry-date" style={{ marginTop: entry.title ? undefined : 0 }}>
                {formatDate(entry.entryDate)}
                {entry.author && (
                  <span style={{ marginLeft: "0.75rem" }}>{entry.author}</span>
                )}
              </p>
            )}
            {!entry.entryDate && entry.author && (
              <p className="orbit-entry-date">{entry.author}</p>
            )}
          </div>
          {canEditEntry && (
            <div className="flex items-center gap-2 shrink-0">
              <Link to={`/${type}/${entry.id}/edit`} className="orbit-btn">
                编辑
              </Link>
              <button
                type="button"
                onClick={handleDeleteArticle}
                className="orbit-btn"
                aria-label="删除"
                title="删除"
                style={{ color: "var(--color-danger, oklch(0.55 0.2 27))" }}
              >
                删除
              </button>
            </div>
          )}
        </div>
        <TiptapEditor
          defaultValue={entry.body}
          readonly
          inlineComments={comments.inline}
          enableInlineComments={capabilities.inline}
          activeInlineCommentId={activeInlineCommentId}
          onCreateInlineComment={(draft) => {
            setInlineDraft(draft);
            setActiveInlineCommentId(null);
            window.setTimeout(() => {
              document.querySelector(".orbit-inline-draft textarea")?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }, 0);
          }}
          onSelectInlineComment={setActiveInlineCommentId}
        />

        {(capabilities.bottom || capabilities.inline) && (
          <CommentSection
            comments={comments.bottom}
            inlineComments={comments.inline}
            activeInlineCommentId={activeInlineCommentId}
            currentAuthor={currentAuthor}
            enableBottom={capabilities.bottom}
            enableInline={capabilities.inline}
            inlineDraft={inlineDraft}
            onCreateBottom={(body) => handleCreateBottom(body)}
            onCreateInline={handleCreateInline}
            onCancelInlineDraft={() => setInlineDraft(null)}
            onReplyBottom={(parentId, body) => handleCreateBottom(body, parentId)}
            onDelete={handleDeleteComment}
            onSelectInline={setActiveInlineCommentId}
          />
        )}
      </div>

      {/* 桌面端：右侧 TOC */}
      {toc.length > 0 && (
        <aside className="hidden xl:block w-56 shrink-0 sticky top-8 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
          <TableOfContents items={toc} />
        </aside>
      )}

      {/* 移动端：浮动按钮 + 底部抽屉 */}
      <MobileToc items={toc} />
    </div>
  );
}
