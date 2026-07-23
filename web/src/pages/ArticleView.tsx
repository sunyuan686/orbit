import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "../lib/api";
import { queryKeys } from "../lib/queryKeys";
import { setPageTitle } from "../lib/pageTitle";
import { useConfirm } from "../lib/useConfirm";
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
import { LetterThreadPanel } from "../components/LetterThreadPanel";
import { useAiArticleMeta } from "../lib/aiArticleContext";
import { formatAiArticleContextLabel } from "../lib/aiArticleLabel";

const EMPTY_COMMENTS: CommentGroups = { bottom: [], inline: [] };

export function ArticleView() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { setMeta: setAiArticleMeta } = useAiArticleMeta();
  const { data: session } = authClient.useSession();
  const [inlineDraft, setInlineDraft] = useState<{
    quote: string;
    anchorFrom: number;
    anchorTo: number;
    anchorPrefix: string;
    anchorSuffix: string;
  } | null>(null);
  const [activeInlineCommentId, setActiveInlineCommentId] = useState<string | null>(null);
  const [marginaliaOpen, setMarginaliaOpen] = useState(false);

  const targetType = type === "memo" ? "memo" : "entry";

  const entryQuery = useQuery({
    queryKey: queryKeys.entry(id!),
    queryFn: () => fetchEntry(id!),
    enabled: Boolean(id),
  });

  const commentsQuery = useQuery({
    queryKey: queryKeys.comments(targetType, id!),
    queryFn: () => fetchComments(targetType, id!),
    enabled: Boolean(id),
  });

  const entry = entryQuery.data ?? null;
  const comments = commentsQuery.data ?? EMPTY_COMMENTS;
  const capabilities = getCommentCapabilities(entry?.type ?? type);
  const sessionUserId = session?.user?.id ?? null;
  const currentAuthor = session?.user?.name ?? null;
  const canEditEntry = canEditContent(
    entry?.type ?? type ?? "",
    entry?.userId,
    sessionUserId
  );
  const canDeleteEntry = canDeleteContent(entry?.userId, sessionUserId);

  useEffect(() => {
    setActiveInlineCommentId(null);
    setInlineDraft(null);
    setMarginaliaOpen(false);
  }, [id]);

  useEffect(() => {
    if (entryQuery.isError && shouldToastApiError(entryQuery.error)) {
      toast.error(getApiErrorMessage(entryQuery.error, "加载失败"));
    }
  }, [entryQuery.isError, entryQuery.error, toast]);

  useEffect(() => {
    if (commentsQuery.isError && shouldToastApiError(commentsQuery.error)) {
      toast.error("评论加载失败");
    }
  }, [commentsQuery.isError, commentsQuery.error, toast]);

  useEffect(() => {
    if (!entry) return;
    setPageTitle(entry.title || TYPE_LABEL[type || ""] || "详情");
    setAiArticleMeta({
      articleId: entry.id,
      title: formatAiArticleContextLabel(entry),
    });
    return () => setAiArticleMeta(null);
  }, [entry, setAiArticleMeta, type]);

  const toc = useMemo(
    () => (entry ? extractToc(entry.body) : []),
    [entry]
  );

  async function refreshComments() {
    if (!id) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.comments(targetType, id),
    });
  }

  if (entryQuery.isError) return <p className="orbit-danger-text">文章不存在</p>;
  if (!entry) return <p className="orbit-muted">加载中…</p>;

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
    const confirmed = await confirm({
      message: "确定删除这条内容吗？删除后无法恢复。",
      confirmLabel: "删除",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteEntry(entry.id);
      await queryClient.invalidateQueries({ queryKey: ["entries"] });
      await queryClient.invalidateQueries({ queryKey: queryKeys.entry(entry.id) });
      await queryClient.invalidateQueries({ queryKey: ["gallery"] });
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
          <div className="flex items-center gap-2 shrink-0">
            {entry.type === "letter" && (
              <Link
                to={`/letter/new?replyTo=${encodeURIComponent(entry.parentId ?? entry.id)}`}
                className="orbit-btn orbit-btn-primary"
              >
                写回信
              </Link>
            )}
            {canEditEntry && (
              <Link to={`/${type}/${entry.id}/edit`} className="orbit-btn">
                编辑
              </Link>
            )}
            {canEditEntry && canDeleteEntry && (
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
        </div>

        {entry.type === "letter" && <LetterThreadPanel entry={entry} />}

        <div className="orbit-article-body-row">
          <TocRail items={toc} />

          <div className="flex flex-1 min-w-0 flex-col">
            <div className="orbit-prose-row flex min-w-0 w-full">
              <div
                className={`flex-1 min-w-0${entry.type === "letter" ? " orbit-letter-sheet" : ""}`}
              >
                <TiptapEditor
                  key={entry.id}
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
