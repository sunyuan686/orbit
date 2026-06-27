import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Link } from "react-router-dom";
import {
  deleteAiConversation,
  fetchAiConversation,
  fetchAiConversations,
  getApiErrorMessage,
  patchAiConversation,
  shouldToastApiError,
  type AiContextMode,
  type AiConversationListItem,
} from "../lib/api";
import { useToast } from "../lib/useToast";
import { AiConversationList } from "./AiConversationList";
import { CloseIcon } from "./OrbitIcons";

export interface AiChatContext {
  mode: AiContextMode;
  articleId?: string;
}

interface AiChatPanelProps {
  open: boolean;
  onClose: () => void;
  context: AiChatContext;
  articleTitle?: string;
}

function createChatId(): string {
  return `orbit-ai-${crypto.randomUUID()}`;
}

function getMessageText(message: UIMessage): string {
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("");
  }
  const legacy = (message as UIMessage & { content?: string }).content;
  return typeof legacy === "string" ? legacy : "";
}

function getMessageReasoning(message: UIMessage): string {
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .filter((part) => part.type === "reasoning")
    .map((part) => part.text)
    .join("");
}

function getMessageAuthor(message: UIMessage): string | undefined {
  const meta = (message as UIMessage & { metadata?: { author?: string } }).metadata;
  return meta?.author;
}

export function AiChatPanel({
  open,
  onClose,
  context,
  articleTitle,
}: AiChatPanelProps) {
  const toast = useToast();
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [conversations, setConversations] = useState<AiConversationListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [shared, setShared] = useState(false);
  const [input, setInput] = useState("");
  const [showListMobile, setShowListMobile] = useState(true);
  const [chatSession, setChatSession] = useState(() => ({
    id: createChatId(),
    messages: [] as UIMessage[],
  }));
  const conversationIdRef = useRef<string | undefined>(undefined);
  const contextRef = useRef(context);
  const openSessionRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  contextRef.current = context;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        credentials: "include",
        body: () => ({
          conversationId: conversationIdRef.current,
          context: contextRef.current,
        }),
        fetch: async (url, init) => {
          const res = await fetch(url, init);
          const headerId = res.headers.get("X-Conversation-Id");
          if (headerId) {
            conversationIdRef.current = headerId;
            setConversationId((current) => current ?? headerId);
          }
          return res;
        },
      }),
    []
  );

  const { messages, sendMessage, status, error, clearError } = useChat({
    id: chatSession.id,
    messages: chatSession.messages,
    transport,
  });

  const reloadList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await fetchAiConversations({
        articleId: context.mode === "article" ? context.articleId : undefined,
      });
      setConversations(data.items);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载对话列表失败"));
      }
    } finally {
      setListLoading(false);
    }
  }, [context.articleId, context.mode, toast]);

  useEffect(() => {
    if (!open) {
      openSessionRef.current = null;
      return;
    }

    const sessionKey = `${context.mode}:${context.articleId ?? ""}`;
    if (openSessionRef.current === sessionKey) return;

    openSessionRef.current = sessionKey;
    setChatSession({ id: createChatId(), messages: [] });
    conversationIdRef.current = undefined;
    setConversationId(undefined);
    setIsOwner(true);
    setShared(false);
    setShowListMobile(true);
    clearError();
  }, [open, context.articleId, context.mode]);

  useEffect(() => {
    if (!open) return;
    void reloadList();
  }, [open, reloadList]);

  async function loadConversation(id: string) {
    setShowListMobile(false);
    setDetailLoading(true);
    clearError();
    try {
      const detail = await fetchAiConversation(id);
      conversationIdRef.current = detail.id;
      setConversationId(detail.id);
      setChatSession({
        id: createChatId(),
        messages: detail.messages as UIMessage[],
      });
      setIsOwner(detail.isOwner);
      setShared(detail.shared);
      setShowListMobile(false);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载对话失败"));
      }
    } finally {
      setDetailLoading(false);
    }
  }

  function startNewConversation() {
    conversationIdRef.current = undefined;
    setConversationId(undefined);
    setChatSession({ id: createChatId(), messages: [] });
    setIsOwner(true);
    setShared(false);
    setShowListMobile(false);
    clearError();
  }

  async function handleToggleShared(next: boolean) {
    if (!conversationId || !isOwner) return;
    if (next && !window.confirm("对方将看到完整对话内容，确定开启共享吗？")) {
      return;
    }
    try {
      await patchAiConversation(conversationId, { shared: next });
      setShared(next);
      toast.success(next ? "已开启与 TA 共享" : "已关闭共享");
      await reloadList();
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "更新共享状态失败"));
      }
    }
  }

  async function handleDeleteConversation(id: string) {
    if (!window.confirm("删除后双方都无法再查看此对话，确定吗？")) return;
    try {
      await deleteAiConversation(id);
      if (conversationId === id) startNewConversation();
      await reloadList();
      toast.success("对话已删除");
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "删除对话失败"));
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text || status === "streaming" || status === "submitted") return;
    setInput("");
    setShowListMobile(false);
    await sendMessage({ text });
    void reloadList();
  }

  if (!open) return null;

  const contextLabel =
    context.mode === "article"
      ? articleTitle ? `文章：${articleTitle}` : "文章上下文"
      : "全局";

  const isBusy = status === "streaming" || status === "submitted" || detailLoading;
  const configError =
    error?.message?.includes("API Key") || error?.message?.includes("未配置");

  return (
    <div className="orbit-ai-overlay" role="presentation" onMouseDown={onClose}>
      <aside
        className="orbit-ai-panel"
        role="dialog"
        aria-label="AI 助手"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="orbit-ai-panel-header">
          <div className="orbit-ai-panel-header-main">
            <button
              type="button"
              className="orbit-btn-ghost orbit-btn-sm md:hidden"
              onClick={() => setShowListMobile((value) => !value)}
            >
              {showListMobile ? "对话" : "返回列表"}
            </button>
            <div>
              <h2 className="orbit-ai-panel-title">AI 助手</h2>
              <p className="orbit-ai-panel-context">{contextLabel}</p>
            </div>
          </div>
          <button
            type="button"
            className="orbit-icon-btn"
            aria-label="关闭"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </header>

        <div className="orbit-ai-panel-body">
          <div
            className={`orbit-ai-list-rail${showListMobile ? "" : " orbit-ai-list-rail--hidden-mobile"}`}
          >
            <AiConversationList
              items={conversations}
              loading={listLoading}
              activeId={conversationId}
              onSelect={(id) => void loadConversation(id)}
              onNew={startNewConversation}
              onDelete={(id) => void handleDeleteConversation(id)}
            />
          </div>

          <div
            className={`orbit-ai-chat-main${showListMobile ? " orbit-ai-chat-main--hidden-mobile" : ""}`}
          >
            {isOwner && conversationId ? (
              <label className="orbit-ai-shared-row">
                <span>与 TA 共享此对话</span>
                <input
                  type="checkbox"
                  checked={shared}
                  disabled={isBusy}
                  onChange={(event) => void handleToggleShared(event.target.checked)}
                />
              </label>
            ) : null}

            {!isOwner && conversationId ? (
              <p className="orbit-muted orbit-ai-shared-note">
                {conversations.find((item) => item.id === conversationId)?.ownerAuthor ?? "对方"}
                {" "}
                共享的对话
              </p>
            ) : null}

            <div className="orbit-ai-messages" aria-live="polite">
              {messages.length === 0 && !detailLoading ? (
                <p className="orbit-muted text-sm orbit-ai-empty">
                  试试：「帮我找去年夏天的日记」
                </p>
              ) : null}
              {messages.map((message) => {
                const text = getMessageText(message);
                const reasoning = getMessageReasoning(message);
                if (!text && !reasoning) return null;
                const author = getMessageAuthor(message);
                return (
                  <div
                    key={message.id}
                    className={`orbit-ai-message orbit-ai-message--${message.role}`}
                  >
                    {message.role === "user" && author ? (
                      <span className="orbit-ai-message-author">{author}</span>
                    ) : null}
                    {reasoning ? (
                      <details className="orbit-ai-reasoning">
                        <summary>推理过程</summary>
                        <div className="orbit-ai-reasoning-body">{reasoning}</div>
                      </details>
                    ) : null}
                    {text ? (
                      <div className="orbit-ai-message-bubble">{text}</div>
                    ) : null}
                  </div>
                );
              })}
              {isBusy ? <p className="orbit-muted text-sm">思考中…</p> : null}
            </div>

            {error ? (
              <div className="orbit-ai-error">
                <p className="orbit-danger-text text-sm">{error.message}</p>
                {configError ? (
                  <Link to="/settings?tab=ai" className="orbit-text-link text-sm">
                    前往 AI 设置
                  </Link>
                ) : null}
              </div>
            ) : null}

            <form className="orbit-ai-composer" onSubmit={(e) => void handleSubmit(e)}>
              <textarea
                value={input}
                rows={2}
                placeholder="输入消息…"
                className="orbit-input orbit-ai-input"
                disabled={isBusy}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit(event);
                  }
                }}
              />
              <button
                type="submit"
                className="orbit-btn orbit-btn-primary"
                disabled={isBusy || !input.trim()}
              >
                发送
              </button>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
