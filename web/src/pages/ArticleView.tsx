import { useCallback, useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  authClient,
  createComment,
  deleteComment,
  deleteEntry,
  fetchComments,
  fetchEntry,
  getApiErrorMessage,
  shouldToastApiError,
  TYPE_LABEL,
  updateComment,
  type CommentGroups,
  type EntryDetail,
} from "../lib/api";
import { setPageTitle } from "../lib/pageTitle";
import { useToast } from "../lib/useToast";
import { TiptapEditor } from "../components/TiptapEditor";
import { ArrowLeftIcon } from "../components/OrbitIcons";
import { ArticleMetadata } from "../components/ArticleMetadata";
import { CommentSection } from "../components/CommentSection";
import { MarginaliaRail, MobileMarginalia } from "../components/MarginaliaRail";
import { TocRail, MobileToc } from "../components/TableOfContents";
import { extractToc } from "../lib/toc";
import { getCommentCapabilities } from "../lib/commentCapabilities";
import { canEditContent, canDeleteContent } from "../lib/contentPolicies";

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
  const [marginaliaOpen, setMarginaliaOpen] = useState(false);
  const [error, setError] = useState(false);

  const capabilities = getCommentCapabilities(entry?.type ?? type);
  const targetType = entry?.type === "memo" ? "memo" : "entry";
  const currentAuthor = session?.user?.name ?? null;
  const canEditEntry = canEditContent(entry?.type ?? type ?? "", entry?.author, currentAuthor);
  const canDeleteEntry = canDeleteContent(entry?.author, currentAuthor);

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

  if (error) return <p className="orbit-danger-text">文章不存在</p>;
  if (!entry) return <p className="orbit-muted">加载中…</p>;

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
      setMarginaliaOpen(true);
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

  async function handleEditComment(commentId: string, body: string) {
    try {
      await updateComment(commentId, body);
      await refreshComments();
    } catch (err) {
      toast.error(getApiErrorMessage(err, "保存评论失败"));
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

  function handleSelectInline(commentId: string) {
    setActiveInlineCommentId(commentId);
    setMarginaliaOpen(true);
  }

  function handleCreateInlineDraft(draft: {
    quote: string;
    anchorFrom: number;
    anchorTo: number;
    anchorPrefix: string;
    anchorSuffix: string;
  }) {
    setInlineDraft(draft);
    setActiveInlineCommentId(null);
    setMarginaliaOpen(true);
  }

  return (
    <div className="orbit-article-layout flex gap-4 xl:gap-5">
      <div className="orbit-article-main min-w-0 flex-1 flex flex-col">
        <button
          type="button"
          onClick={() => (type ? navigate(`/${type}`) : navigate(-1))}
          className="orbit-back-link mb-4"
          aria-label="返回列表"
        >
          <ArrowLeftIcon />
          返回{TYPE_LABEL[type || ""] ? TYPE_LABEL[type || ""] : "列表"}
        </button>

        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            {entry.title && (
              <h2 className="orbit-page-title orbit-page-title--tight">
                {entry.title}
              </h2>
            )}
            <ArticleMetadata
              type={entry.type}
              author={entry.author}
              modifiedBy={entry.modifiedBy ?? null}
              entryDate={entry.entryDate}
              createdAt={entry.createdAt}
              updatedAt={entry.updatedAt}
            />
          </div>
          {canEditEntry && (
            <div className="flex items-center gap-2 shrink-0">
              <Link to={`/${type}/${entry.id}/edit`} className="orbit-btn">
                编辑
              </Link>
              {canDeleteEntry && (
                <button
                  type="button"
                  onClick={handleDeleteArticle}
                  className="orbit-btn orbit-btn-danger"
                  aria-label="删除"
                  title="删除"
                >
                  删除
                </button>
              )}
            </div>
          )}
        </div>

        <div className="orbit-article-body-row">
          <TocRail items={toc} />

          <div className="flex flex-1 min-w-0 flex-col">
            <div className="orbit-prose-row flex min-w-0 w-full">
              <div className="flex-1 min-w-0">
                <TiptapEditor
                  defaultValue={entry.body}
                  readonly
                  inlineComments={comments.inline}
                  enableInlineComments={capabilities.inline}
                  activeInlineCommentId={activeInlineCommentId}
                  inlineDraft={inlineDraft}
                  currentAuthor={currentAuthor}
                  onCreateInlineComment={handleCreateInlineDraft}
                  onCancelInlineDraft={() => setInlineDraft(null)}
                  onSubmitInlineComment={handleCreateInline}
                  onSelectInlineComment={handleSelectInline}
                />
              </div>

              {capabilities.inline && (
                <MarginaliaRail
                  inlineComments={comments.inline}
                  activeInlineCommentId={activeInlineCommentId}
                  currentAuthor={currentAuthor}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  onSelectInline={handleSelectInline}
                />
              )}
            </div>

            {capabilities.bottom && (
              <CommentSection
                comments={comments.bottom}
                currentAuthor={currentAuthor}
                onCreateBottom={(body) => handleCreateBottom(body)}
                onReplyBottom={(parentId, body) => handleCreateBottom(body, parentId)}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
              />
            )}
          </div>
        </div>
      </div>

      {capabilities.inline && (
        <MobileMarginalia
          open={marginaliaOpen}
          onOpenChange={setMarginaliaOpen}
          inlineComments={comments.inline}
          activeInlineCommentId={activeInlineCommentId}
          currentAuthor={currentAuthor}
          onEdit={handleEditComment}
          onDelete={handleDeleteComment}
          onSelectInline={handleSelectInline}
        />
      )}

      <MobileToc items={toc} />
    </div>
  );
}
