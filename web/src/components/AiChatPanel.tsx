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
import { AiLayoutMenu, type AiPanelLayout } from "./AiLayoutMenu";
import { AiModelPicker } from "./AiModelPicker";
import {
  AiIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
} from "./OrbitIcons";

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

const AI_PANEL_WIDTH_KEY = "orbit-ai-panel-width";
const AI_PANEL_LAYOUT_KEY = "orbit-ai-panel-layout";
const AI_FLOATING_POS_KEY = "orbit-ai-panel-floating-pos";
const AI_PANEL_DEFAULT_WIDTH = 360;
const AI_PANEL_MIN_WIDTH = 300;
const AI_PANEL_MAX_WIDTH = 640;

function readStoredAiPanelWidth(): number {
  const saved = localStorage.getItem(AI_PANEL_WIDTH_KEY);
  const width = saved ? Number(saved) : AI_PANEL_DEFAULT_WIDTH;
  if (!Number.isFinite(width)) return AI_PANEL_DEFAULT_WIDTH;
  return Math.max(AI_PANEL_MIN_WIDTH, Math.min(AI_PANEL_MAX_WIDTH, width));
}

function readStoredAiPanelLayout(): AiPanelLayout {
  const saved = localStorage.getItem(AI_PANEL_LAYOUT_KEY);
  if (saved === "floating" || saved === "fullscreen" || saved === "sidebar") {
    return saved;
  }
  return "sidebar";
}

type FloatingPos = { x: number; y: number };

function defaultFloatingPos(width: number): FloatingPos {
  const margin = 16;
  const height = Math.min(window.innerHeight * 0.75, 640);
  return {
    x: Math.max(margin, window.innerWidth - width - margin),
    y: Math.max(56, window.innerHeight - height - 88),
  };
}

function readStoredFloatingPos(width: number): FloatingPos {
  const saved = localStorage.getItem(AI_FLOATING_POS_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved) as FloatingPos;
      if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
        return parsed;
      }
    } catch {
      /* use default */
    }
  }
  return defaultFloatingPos(width);
}

function clampFloatingPos(pos: FloatingPos, width: number, height: number): FloatingPos {
  const margin = 8;
  const maxX = Math.max(margin, window.innerWidth - width - margin);
  const maxY = Math.max(margin, window.innerHeight - height - margin);
  return {
    x: Math.max(margin, Math.min(maxX, pos.x)),
    y: Math.max(margin, Math.min(maxY, pos.y)),
  };
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
  const [showHistory, setShowHistory] = useState(false);
  const [panelMounted, setPanelMounted] = useState(open);
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelWidth, setPanelWidth] = useState(readStoredAiPanelWidth);
  const [panelLayout, setPanelLayout] = useState(readStoredAiPanelLayout);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [floatingPos, setFloatingPos] = useState(() => readStoredFloatingPos(readStoredAiPanelWidth()));
  const [floatingDragging, setFloatingDragging] = useState(false);
  const floatingDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const floatingPosRef = useRef(floatingPos);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [chatSession, setChatSession] = useState(() => ({
    id: createChatId(),
    messages: [] as UIMessage[],
  }));
  const conversationIdRef = useRef<string | undefined>(undefined);
  const contextRef = useRef(context);
  const openSessionRef = useRef<string | null>(null);
  conversationIdRef.current = conversationId;
  contextRef.current = context;

  floatingPosRef.current = floatingPos;

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
    setShowHistory(false);
    clearError();
  }, [open, context.articleId, context.mode]);

  useEffect(() => {
    if (!open) return;
    void reloadList();
  }, [open, reloadList]);

  useEffect(() => {
    if (open) {
      setPanelMounted(true);
      const frame = requestAnimationFrame(() => setPanelVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    setPanelVisible(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPanelMounted(false);
    }
  }, [open]);

  useEffect(() => {
    if (!panelMounted || !open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panelMounted, open, onClose]);

  useEffect(() => {
    localStorage.setItem(AI_PANEL_LAYOUT_KEY, panelLayout);
  }, [panelLayout]);

  useEffect(() => {
    if (!open) setLayoutMenuOpen(false);
  }, [open]);

  function handleLayoutSelect(next: AiPanelLayout) {
    setPanelLayout(next);
    if (next === "floating" && !localStorage.getItem(AI_FLOATING_POS_KEY)) {
      const pos = defaultFloatingPos(panelWidth);
      setFloatingPos(pos);
      floatingPosRef.current = pos;
    }
  }

  const handleResizeMouseDown = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;

    function handleMouseMove(event: MouseEvent) {
      const nextWidth = Math.max(
        AI_PANEL_MIN_WIDTH,
        Math.min(AI_PANEL_MAX_WIDTH, window.innerWidth - event.clientX)
      );
      setPanelWidth(nextWidth);
      localStorage.setItem(AI_PANEL_WIDTH_KEY, String(nextWidth));
    }

    function handleMouseUp() {
      setResizing(false);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [resizing]);

  const handleFloatingDragStart = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (panelLayout !== "floating") return;
      if ((event.target as HTMLElement).closest(".orbit-ai-panel-header-actions")) return;
      if ((event.target as HTMLElement).closest(".orbit-ai-panel-title-btn")) return;
      event.preventDefault();
      floatingDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: floatingPosRef.current.x,
        originY: floatingPosRef.current.y,
      };
      setFloatingDragging(true);
    },
    [panelLayout]
  );

  useEffect(() => {
    if (!floatingDragging) return;

    function handleMouseMove(event: MouseEvent) {
      const start = floatingDragRef.current;
      if (!start) return;
      const height = panelRef.current?.offsetHeight ?? 520;
      const next = clampFloatingPos(
        {
          x: start.originX + (event.clientX - start.startX),
          y: start.originY + (event.clientY - start.startY),
        },
        panelWidth,
        height
      );
      floatingPosRef.current = next;
      setFloatingPos(next);
    }

    function handleMouseUp() {
      setFloatingDragging(false);
      floatingDragRef.current = null;
      localStorage.setItem(AI_FLOATING_POS_KEY, JSON.stringify(floatingPosRef.current));
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [floatingDragging, panelWidth]);

  useEffect(() => {
    if (panelLayout !== "floating") return;

    function handleResize() {
      const height = panelRef.current?.offsetHeight ?? 520;
      setFloatingPos((prev) => {
        const next = clampFloatingPos(prev, panelWidth, height);
        floatingPosRef.current = next;
        localStorage.setItem(AI_FLOATING_POS_KEY, JSON.stringify(next));
        return next;
      });
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [panelLayout, panelWidth]);

  function handlePanelTransitionEnd(event: React.TransitionEvent<HTMLElement>) {
    if (event.target !== panelRef.current) return;
    if (event.propertyName !== "transform" && event.propertyName !== "opacity") return;
    if (!panelVisible) setPanelMounted(false);
  }

  const isSidebarLayout = panelLayout === "sidebar";

  async function loadConversation(id: string) {
    setShowListMobile(false);
    setShowHistory(false);
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
    setShowHistory(false);
    clearError();
  }

  function handleSuggestion(text: string) {
    setInput(text);
    setShowListMobile(false);
    setShowHistory(false);
    inputRef.current?.focus();
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

  if (!panelMounted) return null;

  const activeConversation = conversations.find((item) => item.id === conversationId);
  const headerTitle = activeConversation?.title ?? "新对话";
  const contextLabel =
    context.mode === "article"
      ? articleTitle ?? "文章上下文"
      : "全局";

  const suggestions =
    context.mode === "article"
      ? [
          "总结这篇文章",
          "帮我扩展这段内容",
          "用更温柔的语气改写",
        ]
      : [
          "帮我找去年夏天的日记",
          "最近写了哪些内容",
          "回顾一下我们的信件",
        ];

  const isBusy = status === "streaming" || status === "submitted" || detailLoading;
  const configError =
    error?.message?.includes("API Key") || error?.message?.includes("未配置");
  const isFloatingLayout = panelLayout === "floating";
  const panelStyle = {
    ["--ai-panel-width" as string]: `${panelWidth}px`,
    ...(isFloatingLayout
      ? { left: `${floatingPos.x}px`, top: `${floatingPos.y}px` }
      : {}),
  };

  return (
    <div
      className={`orbit-ai-overlay orbit-ai-overlay--${panelLayout}${panelVisible ? " orbit-ai-overlay--visible" : ""}`}
      role="presentation"
      onMouseDown={onClose}
    >
      <aside
        ref={panelRef}
        className={`orbit-ai-panel orbit-ai-panel--${panelLayout}${panelVisible ? " orbit-ai-panel--visible" : ""}${resizing ? " orbit-ai-panel--resizing" : ""}${floatingDragging ? " orbit-ai-panel--floating-dragging" : ""}`}
        style={panelStyle}
        role="dialog"
        aria-label="Orbit AI"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
        onTransitionEnd={handlePanelTransitionEnd}
      >
        {isSidebarLayout ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="调整面板宽度"
            className="orbit-ai-resize-handle"
            onMouseDown={handleResizeMouseDown}
          />
        ) : null}
        <header
          className={`orbit-ai-panel-header${isFloatingLayout ? " orbit-ai-panel-header--draggable" : ""}`}
          onMouseDown={handleFloatingDragStart}
        >
          <button
            type="button"
            className="orbit-ai-panel-title-btn orbit-ai-panel-header-mobile-only"
            onClick={() => setShowListMobile((value) => !value)}
          >
            <span className="orbit-ai-panel-title-btn-label">
              {showListMobile ? "对话列表" : headerTitle}
            </span>
          </button>
          <button
            type="button"
            className="orbit-ai-panel-title-btn"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((value) => !value)}
          >
            <span className="orbit-ai-panel-title-btn-label">{headerTitle}</span>
            <ChevronDownIcon
              size="sm"
              className={`orbit-ai-panel-title-btn-chevron${showHistory ? " orbit-ai-panel-title-btn-chevron--open" : ""}`}
            />
          </button>
          <div className="orbit-ai-panel-header-actions">
            <button
              type="button"
              className="orbit-icon-btn"
              aria-label="新对话"
              title="新对话"
              onClick={startNewConversation}
            >
              <PlusIcon size="sm" />
            </button>
            <AiLayoutMenu
              layout={panelLayout}
              open={layoutMenuOpen}
              onOpenChange={setLayoutMenuOpen}
              onSelect={handleLayoutSelect}
            />
            <button
              type="button"
              className="orbit-icon-btn"
              aria-label="收起"
              title={isFloatingLayout ? "收起（可拖动标题栏移动窗口）" : "收起"}
              onClick={onClose}
            >
              <ChevronRightIcon size="sm" />
            </button>
          </div>
        </header>

        <div className="orbit-ai-panel-body">
          {showHistory ? (
            <div className="orbit-ai-history-sheet">
              <AiConversationList
                items={conversations}
                loading={listLoading}
                activeId={conversationId}
                onSelect={(id) => void loadConversation(id)}
                onNew={startNewConversation}
                onDelete={(id) => void handleDeleteConversation(id)}
              />
            </div>
          ) : null}

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
                <div className="orbit-ai-welcome">
                  <div className="orbit-ai-welcome-icon" aria-hidden="true">
                    <AiIcon size="md" />
                  </div>
                  <h2 className="orbit-ai-welcome-title">Orbit AI</h2>
                  <p className="orbit-ai-welcome-desc">
                    可以帮你查找、总结和整理空间里的内容，随便问点什么吧。
                  </p>
                  <div className="orbit-ai-suggestions">
                    {suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="orbit-ai-suggestion"
                        onClick={() => handleSuggestion(suggestion)}
                      >
                        <span className="orbit-ai-suggestion-icon" aria-hidden="true">
                          <SearchIcon size="sm" />
                        </span>
                        <span>{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
              <div className="orbit-ai-composer-card">
                {context.mode === "article" ? (
                  <div className="orbit-ai-context-pill">
                    <span className="orbit-ai-context-pill-label">{contextLabel}</span>
                  </div>
                ) : null}
                <textarea
                  ref={inputRef}
                  value={input}
                  rows={2}
                  placeholder="随便问点什么…"
                  className="orbit-ai-composer-input"
                  disabled={isBusy}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSubmit(event);
                    }
                  }}
                />
                <div className="orbit-ai-composer-toolbar">
                  <AiModelPicker disabled={isBusy} onNavigateAway={onClose} />
                  <button
                    type="submit"
                    className="orbit-ai-send-btn"
                    aria-label="发送"
                    disabled={isBusy || !input.trim()}
                  >
                    <ArrowUpIcon size="sm" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
