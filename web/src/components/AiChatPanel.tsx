import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { Link } from "react-router-dom";
import "streamdown/styles.css";
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
import { parseAssistantContent } from "../lib/ai-message-content";
import { safeRandomUUID } from "../lib/uuid";
import { formatWriteContentApprovalSummary } from "../lib/ai-write-approval";
import { applyToolApprovalResponse } from "../../../src/services/ai-tool-approval";
import { useMaxWidthMd } from "../lib/useBreakpoint";
import { useConfirm } from "../lib/useConfirm";
import { useToast } from "../lib/useToast";
import { AiConversationList } from "./AiConversationList";
import { AiLayoutMenu, type AiPanelLayout } from "./AiLayoutMenu";
import { AiModelPicker } from "./AiModelPicker";
import { VoiceInputButton } from "./VoiceInputButton";
import {
  AiIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CloseIcon,
  MenuIcon,
  PlusIcon,
  ReloadIcon,
  SearchIcon,
  ShareIcon,
  StopIcon,
  ThinkingIcon,
  NAV_CONTENT_ICONS,
  type NavContentType,
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
  articleType?: NavContentType;
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
  return `orbit-ai-${safeRandomUUID()}`;
}

type ChatSessionState = {
  id: string;
  messages: UIMessage[];
  conversationId?: string;
};

function createChatSession(
  messages: UIMessage[] = [],
  conversationId?: string
): ChatSessionState {
  return {
    id: createChatId(),
    messages,
    conversationId,
  };
}

interface ToolPartShape {
  type: string;
  toolCallId?: string;
  state?:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied";
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: {
    id: string;
    approved?: boolean;
    reason?: string;
    isAutomatic?: boolean;
  };
}

// AI SDK v7 does not expose `toolUIs` on useChat; the supported way to render
// tool calls is to iterate `message.parts` and match `type: "tool-<name>"`.
function isToolPart(part: unknown): part is ToolPartShape {
  if (typeof part !== "object" || part === null || !("type" in part)) return false;
  const type = (part as { type: unknown }).type;
  return typeof type === "string" && type.startsWith("tool-");
}

// Tool cards render the raw tool name (e.g. search_entries) instead of a humanized label.

function getMessageAuthor(message: UIMessage): string | undefined {
  const meta = (message as UIMessage & { metadata?: { author?: string } }).metadata;
  return meta?.author;
}

function WriteContentApprovalActions({
  part,
  onApprove,
  onDeny,
}: {
  part: ToolPartShape;
  onApprove: (approvalId: string) => void;
  onDeny: (approvalId: string) => void;
}) {
  const approvalId = part.approval?.id;
  if (!approvalId || part.approval?.isAutomatic) return null;

  const input = (part.input ?? {}) as {
    action?: string;
    type?: string;
    id?: string;
    title?: string;
    body?: string;
  };

  return (
    <div className="orbit-ai-tool-approval">
      <p className="orbit-ai-tool-approval-title">确认写入空间内容？</p>
      <pre className="orbit-ai-tool-approval-preview">
        {formatWriteContentApprovalSummary(input)}
      </pre>
      <div className="orbit-ai-tool-approval-actions">
        <button
          type="button"
          className="orbit-ai-tool-approval-btn orbit-ai-tool-approval-btn--approve"
          onClick={() => onApprove(approvalId)}
        >
          确认写入
        </button>
        <button
          type="button"
          className="orbit-ai-tool-approval-btn orbit-ai-tool-approval-btn--deny"
          onClick={() => onDeny(approvalId)}
        >
          取消
        </button>
      </div>
    </div>
  );
}

function ToolCallBody({
  toolName,
  part,
  onApprove,
  onDeny,
}: {
  toolName: string;
  part: ToolPartShape;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}) {
  if (toolName === "write_content" && part.state === "approval-requested") {
    if (!onApprove || !onDeny) return null;
    return (
      <WriteContentApprovalActions
        part={part}
        onApprove={onApprove}
        onDeny={onDeny}
      />
    );
  }

  if (toolName === "write_content" && part.state === "output-denied") {
    return (
      <p className="orbit-ai-tool-snippet" style={{ color: "var(--color-red-600, #dc2626)" }}>
        已取消写入
        {part.approval?.reason ? `：${part.approval.reason}` : ""}
      </p>
    );
  }

  if (toolName === "search_entries") {
    const results = (part.output ?? []) as Array<{
      id: string;
      type?: string;
      title?: string;
      entryDate?: string;
      snippet?: string;
    }>;
    if (Array.isArray(results) && results.length > 0) {
      return (
        <ul className="orbit-ai-tool-list">
          {results.slice(0, 6).map((r) => (
            <li key={r.id} className="orbit-ai-tool-item">
              <details>
                <summary className="orbit-ai-tool-item-summary">
                  <span className="orbit-ai-tool-item-title">{r.title ?? "无标题"}</span>
                  {r.entryDate ? (
                    <span className="orbit-ai-tool-item-meta">{r.entryDate}</span>
                  ) : null}
                </summary>
                {r.snippet ? (
                  <span className="orbit-ai-tool-item-snippet">{r.snippet}</span>
                ) : null}
              </details>
            </li>
          ))}
        </ul>
      );
    }
    return null;
  }

  if (toolName === "get_entry") {
    const output = (part.output ?? {}) as {
      title?: string;
      type?: string;
      author?: string;
      entryDate?: string;
      bodyText?: string;
      error?: string;
    };
    return (
      <>
        {output.title ? (
          <p className="orbit-ai-tool-query">{output.title}</p>
        ) : null}
        {output.bodyText ? (
          <p className="orbit-ai-tool-snippet">
            {output.bodyText.slice(0, 240)}
            {output.bodyText.length > 240 ? "…" : ""}
          </p>
        ) : null}
      </>
    );
  }

  if (toolName === "list_memos") {
    const output = (part.output ?? []) as Array<{
      id?: string;
      key?: string;
      title?: string;
      updatedAt?: number;
    }>;
    if (Array.isArray(output) && output.length > 0) {
      return (
        <ul className="orbit-ai-tool-list">
          {output.slice(0, 8).map((m, i) => (
            <li key={m.id ?? m.key ?? i} className="orbit-ai-tool-item">
              <span className="orbit-ai-tool-item-title">
                {m.title ?? m.key ?? "备忘录"}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    return null;
  }

  if (toolName === "write_content") {
    const output = (part.output ?? {}) as {
      ok?: boolean;
      action?: string;
      id?: string;
      type?: string;
      title?: string | null;
      error?: string;
    };
    if (output.error) {
      return (
        <p className="orbit-ai-tool-snippet" style={{ color: "var(--color-red-600, #dc2626)" }}>
          {output.error}
        </p>
      );
    }
    if (output.ok) {
      const actionLabel =
        output.action === "create"
          ? "已创建"
          : output.action === "update"
            ? "已更新"
            : output.action === "delete"
              ? "已删除"
              : "已完成";
      return (
        <p className="orbit-ai-tool-snippet">
          {actionLabel}
          {output.type ? ` · ${output.type}` : ""}
          {output.title ? ` · ${output.title}` : ""}
          {output.id ? ` · #${output.id}` : ""}
        </p>
      );
    }
    return null;
  }

  if (toolName === "web_search") {
    const output = (part.output ?? {}) as {
      query?: string;
      provider?: string;
      error?: string;
      results?: Array<{
        title: string;
        url: string;
        snippet?: string;
        source?: string;
      }>;
    };
    if (output.error) {
      return (
        <p className="orbit-ai-tool-snippet" style={{ color: "var(--color-red-600, #dc2626)" }}>
          {output.error}
        </p>
      );
    }
    const results = output.results || [];
    if (results.length > 0) {
      return (
        <ul className="orbit-ai-tool-list">
          {results.slice(0, 5).map((r, i) => {
            let host = "";
            try {
              host = new URL(r.url).hostname;
            } catch {
              host = r.url;
            }
            return (
              <li key={i} className="orbit-ai-tool-item">
                <details>
                  <summary className="orbit-ai-tool-item-summary">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="orbit-ai-tool-item-title hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {r.title || "网页链接"}
                    </a>
                    {host ? (
                      <span className="orbit-ai-tool-item-meta">{host}</span>
                    ) : null}
                  </summary>
                  {r.snippet ? (
                    <span className="orbit-ai-tool-item-snippet">{r.snippet}</span>
                  ) : null}
                </details>
              </li>
            );
          })}
        </ul>
      );
    }
  }
  return null;
}

function renderToolArgs(toolName: string, input: unknown): ReactNode {
  if (!input || typeof input !== "object") return null;
  const a = input as Record<string, unknown>;
  if (toolName === "search_entries") {
    const query = typeof a.query === "string" ? a.query : "";
    const type = typeof a.type === "string" ? a.type : "";
    if (!query && !type) return null;
    return (
      <span className="orbit-ai-tool-arg">
        {query ? `"${query}"` : ""}
        {query && type ? " · " : ""}
        {type || ""}
      </span>
    );
  }
  if (toolName === "get_entry") {
    const id = typeof a.id === "string" ? a.id : "";
    if (!id) return null;
    return <span className="orbit-ai-tool-arg">#{id}</span>;
  }
  if (toolName === "list_memos") {
    const limit = typeof a.limit === "number" ? a.limit : null;
    if (limit == null) return null;
    return <span className="orbit-ai-tool-arg">limit={limit}</span>;
  }

  if (toolName === "write_content") {
    const action = typeof a.action === "string" ? a.action : "";
    const type = typeof a.type === "string" ? a.type : "";
    const id = typeof a.id === "string" ? a.id : "";
    const title = typeof a.title === "string" ? a.title : "";
    if (!action && !type && !id && !title) return null;
    return (
      <span className="orbit-ai-tool-arg">
        {action || "write"}
        {type ? ` · ${type}` : ""}
        {title ? ` · "${title}"` : ""}
        {id ? ` · #${id}` : ""}
      </span>
    );
  }

  if (toolName === "web_search") {
    const query = typeof a.query === "string" ? a.query : "";
    if (!query) return null;
    return <span className="orbit-ai-tool-arg">"{query}"</span>;
  }
  return null;
}

class ToolCallErrorBoundary extends Component<
  { children: ReactNode; toolName: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Error in ToolCallCard:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="orbit-ai-tool orbit-ai-tool--error">
          <div className="orbit-ai-tool-header">
            <span className="orbit-ai-tool-name">{this.props.toolName}</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function getToolDisplayName(toolName: string): string {
  switch (toolName) {
    case "search_entries":
      return "检索记录";
    case "get_entry":
      return "查看内容";
    case "list_memos":
      return "查找备忘";
    case "write_content":
      return "写入内容";
    case "web_search":
      return "网络搜索";
    default:
      return toolName;
  }
}

function ToolCallCard({
  part,
  onApprove,
  onDeny,
}: {
  part: ToolPartShape;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}) {
  const toolName = part.type.replace(/^tool-/, "");
  const displayName = getToolDisplayName(toolName);
  const isDone = part.state === "output-available";
  const isError = part.state === "output-error";
  const isDenied = part.state === "output-denied";
  const needsApproval = part.state === "approval-requested";
  const isLoading =
    !isDone && !isError && !isDenied && !needsApproval;
  return (
    <details
      className={
        "orbit-ai-tool" +
        (isLoading ? " orbit-ai-tool--loading" : "") +
        (isError || isDenied ? " orbit-ai-tool--error" : "") +
        (needsApproval ? " orbit-ai-tool--approval" : "")
      }
      open={isLoading || needsApproval || undefined}
    >
      <summary className="orbit-ai-tool-header">
        <span
          className={`orbit-ai-tool-status-dot orbit-ai-tool-status-dot--${
            isLoading
              ? "loading"
              : needsApproval
                ? "approval"
                : isDone
                  ? "done"
                  : "error"
          }`}
          aria-hidden="true"
        />
        <span className="orbit-ai-tool-name">
          {needsApproval ? `${displayName} · 待确认` : displayName}
        </span>
        {renderToolArgs(toolName, part.input)}
        <ChevronDownIcon size="sm" className="orbit-ai-tool-chevron" />
      </summary>
      <div className="orbit-ai-tool-body">
        <ToolCallBody
          toolName={toolName}
          part={part}
          onApprove={onApprove}
          onDeny={onDeny}
        />
      </div>
    </details>
  );
}

function ReasoningAccordion({
  reasoning,
  isStreaming,
  hasText,
}: {
  reasoning: string;
  isStreaming: boolean;
  hasText: boolean;
  messageId: string;
}) {
  const startTimeRef = useRef<number | null>(null);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [finalDuration, setFinalDuration] = useState<number | null>(null);
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);

  useEffect(() => {
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }

    if (!isStreaming) {
      const now = Date.now();
      const start = startTimeRef.current;
      const duration = Math.max(0.1, (now - start) / 1000);
      const timer = setTimeout(() => {
        setFinalDuration(duration);
      }, 0);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => {
      if (startTimeRef.current !== null) {
        const duration = (Date.now() - startTimeRef.current) / 1000;
        setElapsedSec(duration);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isStreaming]);

  const isThinkingActive = isStreaming && !hasText;
  const isOpen = userExpanded ?? isThinkingActive;

  const label = useMemo(() => {
    if (isThinkingActive) {
      return `思考中 (${elapsedSec.toFixed(1)}s)…`;
    }
    if (finalDuration !== null) {
      return `已思考 (用时 ${finalDuration.toFixed(1)}s)`;
    }
    return "已思考";
  }, [isThinkingActive, elapsedSec, finalDuration]);

  return (
    <div className={`orbit-ai-reasoning ${isOpen ? "orbit-ai-reasoning--open" : ""}`}>
      <button
        type="button"
        className="orbit-ai-reasoning-summary"
        onClick={() => setUserExpanded(!isOpen)}
      >
        <ThinkingIcon size="sm" className="orbit-ai-reasoning-icon" />
        <span>{label}</span>
        <ChevronDownIcon size="sm" className="orbit-ai-reasoning-chevron" />
      </button>
      {isOpen ? <div className="orbit-ai-reasoning-body">{reasoning}</div> : null}
    </div>
  );
}

// Renders a message's parts in order (AI SDK v7 best practice): consecutive
// text parts are grouped into a markdown bubble, tool parts become cards.
function MessageBody({
  parts,
  isAssistant,
  isStreaming,
  onApprove,
  onDeny,
}: {
  parts: UIMessage["parts"];
  isAssistant: boolean;
  isStreaming: boolean;
  onApprove?: (approvalId: string) => void;
  onDeny?: (approvalId: string) => void;
}) {
  const nodes: ReactNode[] = [];
  let textBuffer = "";
  const flush = (key: string) => {
    const visibleText = textBuffer;
    if (!visibleText.trim()) {
      textBuffer = "";
      return;
    }
    nodes.push(
      <div className="orbit-ai-message-bubble" key={key}>
        {isAssistant ? (
          <Streamdown
            className="orbit-ai-md"
            controls={false}
            isAnimating={isStreaming}
            mode={isStreaming ? "streaming" : "static"}
          >
            {visibleText}
          </Streamdown>
        ) : (
          visibleText
        )}
      </div>
    );
    textBuffer = "";
  };
  (parts ?? []).forEach((part, i) => {
    if (part.type === "text") {
      textBuffer += part.text;
      return;
    }
    if (isToolPart(part)) {
      flush(`tb-${i}`);
      const toolName = part.type.replace(/^tool-/, "");
      nodes.push(
        <ToolCallErrorBoundary key={`tc-${i}`} toolName={toolName}>
          <ToolCallCard part={part} onApprove={onApprove} onDeny={onDeny} />
        </ToolCallErrorBoundary>
      );
    }
  });
  flush("tb-end");
  return <>{nodes}</>;
}

function hasActionableToolApproval(messages: UIMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    return (message.parts ?? []).some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "approval-requested" &&
        part.approval?.id &&
        !part.approval.isAutomatic
    );
  }
  return false;
}

function hasInFlightWriteTool(messages: UIMessage[]): boolean {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") continue;
    return (message.parts ?? []).some(
      (part) =>
        isToolUIPart(part) &&
        part.type === "tool-write_content" &&
        (part.state === "input-streaming" ||
          part.state === "input-available" ||
          part.state === "approval-requested")
    );
  }
  return false;
}

export function AiChatPanel({
  open,
  onClose,
  context,
  articleTitle,
  articleType,
}: AiChatPanelProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const isMobile = useMaxWidthMd();
  const [conversations, setConversations] = useState<AiConversationListItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [shared, setShared] = useState(false);
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [panelMounted, setPanelMounted] = useState(open);
  const [panelVisible, setPanelVisible] = useState(false);
  const [panelWidth, setPanelWidth] = useState(readStoredAiPanelWidth);
  const [panelLayout, setPanelLayout] = useState(readStoredAiPanelLayout);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [floatingPos, setFloatingPos] = useState(() => readStoredFloatingPos(readStoredAiPanelWidth()));
  const [floatingDragging, setFloatingDragging] = useState(false);
  const [contextDismissed, setContextDismissed] = useState(false);
  const floatingDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const floatingPosRef = useRef(floatingPos);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [chatSession, setChatSession] = useState<ChatSessionState>(() =>
    createChatSession()
  );
  const chatSessionRef = useRef(chatSession);
  const openSessionRef = useRef<string | null>(null);
  const assignConversationIdRef = useRef<(id: string | undefined) => void>(() => {});

  const effectiveContext = useMemo<AiChatContext>(() => {
    if (context.mode === "article" && !contextDismissed) {
      return context;
    }
    return { mode: "global" };
  }, [context, contextDismissed]);

  chatSessionRef.current = chatSession;

  const effectiveContextRef = useRef(effectiveContext);
  effectiveContextRef.current = effectiveContext;

  assignConversationIdRef.current = (id: string | undefined) => {
    const next = { ...chatSessionRef.current, conversationId: id };
    chatSessionRef.current = next;
    setChatSession(next);
  };

  floatingPosRef.current = floatingPos;

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/chat",
        credentials: "include",
        body: () => ({
          conversationId: chatSessionRef.current.conversationId,
          context: effectiveContextRef.current,
        }),
        fetch: async (url, init) => {
          const res = await fetch(url, init);
          const headerId = res.headers.get("X-Conversation-Id");
          if (headerId?.startsWith("aiconv_")) {
            assignConversationIdRef.current(headerId);
          }
          return res;
        },
      }),
    []
  );

  const { messages, sendMessage, status, error, clearError, setMessages, stop, regenerate } = useChat({
    id: chatSession.id,
    messages: chatSession.messages,
    transport,
  });

  const handleToolApproval = useCallback(
    async (approvalId: string, approved: boolean) => {
      setMessages((prev) =>
        applyToolApprovalResponse(
          prev,
          approvalId,
          approved,
          approved ? "用户已确认写入" : "用户已取消写入"
        )
      );
      await sendMessage();
    },
    [setMessages, sendMessage]
  );

  const reloadList = useCallback(async () => {
    setListLoading(true);
    try {
      const data = await fetchAiConversations({
        articleId:
          effectiveContext.mode === "article" ? effectiveContext.articleId : undefined,
      });
      setConversations(data.items);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载对话列表失败"));
      }
    } finally {
      setListLoading(false);
    }
  }, [effectiveContext.articleId, effectiveContext.mode, toast]);

  useEffect(() => {
    setContextDismissed(false);
  }, [context.articleId, context.mode]);

  useEffect(() => {
    if (!open) {
      openSessionRef.current = null;
      return;
    }

    const sessionKey = `${effectiveContext.mode}:${effectiveContext.articleId ?? ""}`;
    if (openSessionRef.current === sessionKey) return;

    openSessionRef.current = sessionKey;
    const nextSession = createChatSession();
    chatSessionRef.current = nextSession;
    setChatSession(nextSession);
    setIsOwner(true);
    setShared(false);
    setShowHistory(false);
    clearError();
  }, [open, effectiveContext.articleId, effectiveContext.mode, clearError]);

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
      if (event.key !== "Escape") return;
      if (showHistory) {
        setShowHistory(false);
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [panelMounted, open, onClose, showHistory]);

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add("orbit-ai-open");
    return () => document.documentElement.classList.remove("orbit-ai-open");
  }, [open]);

  useEffect(() => {
    if (!open || !isMobile) return;

    const root = document.documentElement;
    const vv = window.visualViewport;

    function syncViewport() {
      if (!vv || typeof vv.height !== "number" || vv.height <= 0) {
        root.style.setProperty("--ai-vv-top", "0px");
        root.style.setProperty("--ai-vv-height", "100dvh");
        return;
      }
      // Prefer layout-stable inset: visualViewport tracks keyboard without page zoom.
      // offsetTop + height map the panel to the visible area above the keyboard.
      const top = Math.max(0, vv.offsetTop || 0);
      const height = vv.height > 100 ? vv.height : window.innerHeight;
      root.style.setProperty("--ai-vv-top", `${top}px`);
      root.style.setProperty("--ai-vv-height", `${height}px`);
    }

    syncViewport();
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    return () => {
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      root.style.removeProperty("--ai-vv-top");
      root.style.removeProperty("--ai-vv-height");
    };
  }, [open, isMobile]);

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
      if (isMobile || panelLayout !== "floating") return;
      if ((event.target as HTMLElement).closest("button, a, input, label")) return;
      event.preventDefault();
      floatingDragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        originX: floatingPosRef.current.x,
        originY: floatingPosRef.current.y,
      };
      setFloatingDragging(true);
    },
    [isMobile, panelLayout]
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
    setShowHistory(false);
    setDetailLoading(true);
    clearError();
    try {
      const detail = await fetchAiConversation(id);
      const nextSession = createChatSession(
        detail.messages as UIMessage[],
        detail.id
      );
      chatSessionRef.current = nextSession;
      setChatSession(nextSession);
      setIsOwner(detail.isOwner);
      setShared(detail.shared);
    } catch (err) {
      if (shouldToastApiError(err)) {
        toast.error(getApiErrorMessage(err, "加载对话失败"));
      }
    } finally {
      setDetailLoading(false);
    }
  }

  function startNewConversation() {
    const nextSession = createChatSession();
    chatSessionRef.current = nextSession;
    setChatSession(nextSession);
    setIsOwner(true);
    setShared(false);
    setShowHistory(false);
    clearError();
  }

  function handleSuggestion(text: string) {
    setInput(text);
    setShowHistory(false);
    inputRef.current?.focus();
  }

  async function handleToggleShared(next: boolean) {
    if (!conversationId || !isOwner) return;
    if (
      next &&
      !(await confirm({
        message: "对方将看到完整对话内容，确定开启共享吗？",
        confirmLabel: "开启共享",
      }))
    ) {
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
    if (
      !(await confirm({
        message: "删除后双方都无法再查看此对话，确定吗？",
        confirmLabel: "删除",
        danger: true,
      }))
    ) {
      return;
    }
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
    await sendMessage({ text });
    void reloadList();
  }

  const actionableToolApproval = useMemo(
    () => hasActionableToolApproval(messages),
    [messages]
  );
  const inFlightWriteTool = useMemo(
    () => hasInFlightWriteTool(messages),
    [messages]
  );

  useEffect(() => {
    if (actionableToolApproval && error) {
      clearError();
    }
  }, [actionableToolApproval, clearError, error]);

  if (!panelMounted) return null;

  const conversationId = chatSession.conversationId;
  const activeConversation = conversations.find((item) => item.id === conversationId);
  const headerTitle = activeConversation?.title ?? "新聊天";
  const showArticleContextPill =
    context.mode === "article" && !contextDismissed;
  const contextLabel = articleTitle?.trim() || "当前文档";
  const ContextIcon = articleType ? NAV_CONTENT_ICONS[articleType] : null;

  const suggestions =
    effectiveContext.mode === "article"
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
  const lastMessage = messages[messages.length - 1];
  const hasActiveAssistantContent =
    isBusy &&
    lastMessage?.role === "assistant" &&
    (() => {
      const { reasoning } = parseAssistantContent(lastMessage);
      const parts = lastMessage.parts ?? [];
      const hasText = parts.some((p) => p.type === "text" && Boolean(p.text));
      const hasTool = parts.some((p) => isToolPart(p));
      return Boolean(reasoning) || hasText || hasTool;
    })();
  const configError =
    error?.message?.includes("API Key") || error?.message?.includes("未配置");
  const showStreamError =
    Boolean(error) && !actionableToolApproval && !inFlightWriteTool;
  const isFloatingLayout = panelLayout === "floating";
  // Mobile: full-bleed sheet — do not apply desktop width / floating coords (inline beats media CSS).
  const panelStyle = isMobile
    ? undefined
    : {
        ["--ai-panel-width" as string]: `${panelWidth}px`,
        ...(isFloatingLayout
          ? { left: `${floatingPos.x}px`, top: `${floatingPos.y}px` }
          : {}),
      };

  return (
    <div
      className={`orbit-ai-overlay orbit-ai-overlay--${panelLayout}${panelVisible ? " orbit-ai-overlay--visible" : ""}`}
      role="presentation"
      onPointerDown={onClose}
    >
      <aside
        ref={panelRef}
        className={`orbit-ai-panel orbit-ai-panel--${panelLayout}${panelVisible ? " orbit-ai-panel--visible" : ""}${resizing ? " orbit-ai-panel--resizing" : ""}${floatingDragging ? " orbit-ai-panel--floating-dragging" : ""}`}
        style={panelStyle}
        role="dialog"
        aria-label="Orbit AI"
        aria-modal="true"
        onPointerDown={(event) => event.stopPropagation()}
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
          className={`orbit-ai-panel-header${isFloatingLayout && !isMobile ? " orbit-ai-panel-header--draggable" : ""}`}
          onMouseDown={handleFloatingDragStart}
        >
          <div className="orbit-ai-panel-header-leading">
            <button
              type="button"
              className={`orbit-icon-btn inline-flex${showHistory ? " orbit-icon-btn--active" : ""}`}
              aria-label={showHistory ? "关闭历史" : "打开历史"}
              aria-expanded={showHistory}
              title={showHistory ? "关闭历史" : "历史"}
              onClick={() => setShowHistory((value) => !value)}
            >
              {showHistory ? <CloseIcon size="sm" /> : <MenuIcon size="sm" />}
            </button>
            <div className="orbit-ai-panel-title-wrap">
              <h1 className="orbit-ai-panel-title">{headerTitle}</h1>
              {!isOwner && conversationId ? (
                <p className="orbit-ai-panel-title-sub">
                  {activeConversation?.ownerAuthor ?? "对方"} 共享
                </p>
              ) : isOwner && conversationId && shared ? (
                <p className="orbit-ai-panel-title-sub orbit-ai-panel-title-sub--shared">
                  已与 TA 共享
                </p>
              ) : null}
            </div>
          </div>
          <div className="orbit-ai-panel-header-actions">
            {isOwner && conversationId ? (
              <button
                type="button"
                className={`orbit-icon-btn inline-flex${shared ? " orbit-icon-btn--accent" : ""}`}
                disabled={isBusy}
                aria-pressed={shared}
                aria-label={shared ? "关闭共享" : "与 TA 共享"}
                title={shared ? "已共享，点击关闭" : "与 TA 共享"}
                onClick={() => void handleToggleShared(!shared)}
              >
                <ShareIcon size="sm" />
              </button>
            ) : null}
            <button
              type="button"
              className="orbit-icon-btn inline-flex"
              aria-label="新聊天"
              title="新聊天"
              onClick={startNewConversation}
            >
              <PlusIcon size="sm" />
            </button>
            {!isMobile ? (
              <AiLayoutMenu
                layout={panelLayout}
                open={layoutMenuOpen}
                onOpenChange={setLayoutMenuOpen}
                onSelect={handleLayoutSelect}
              />
            ) : null}
            <button
              type="button"
              className="orbit-icon-btn inline-flex"
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
                onDelete={(id) => void handleDeleteConversation(id)}
              />
            </div>
          ) : null}

          <div className="orbit-ai-chat-main">
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
              {messages.map((message, messageIndex) => {
                const author = getMessageAuthor(message);
                const { reasoning, text: visibleText } =
                  message.role === "assistant"
                    ? parseAssistantContent(message)
                    : { reasoning: "", text: "" };
                const showReasoning = Boolean(reasoning);
                const parts = message.parts ?? [];
                const hasText =
                  message.role === "assistant"
                    ? Boolean(visibleText)
                    : parts.some((p) => p.type === "text" && Boolean(p.text));
                const hasTool = parts.some((p) => isToolPart(p));
                if (!showReasoning && !hasText && !hasTool) return null;
                const isStreamingMessage =
                  status === "streaming" &&
                  message.role === "assistant" &&
                  messageIndex === messages.length - 1;
                return (
                  <div
                    key={message.id}
                    className={`orbit-ai-message orbit-ai-message--${message.role}`}
                  >
                    {message.role === "user" && author ? (
                      <span className="orbit-ai-message-author">{author}</span>
                    ) : null}
                    {showReasoning ? (
                      <ReasoningAccordion
                        reasoning={reasoning}
                        isStreaming={isStreamingMessage}
                        hasText={hasText}
                        messageId={message.id}
                      />
                    ) : null}
                    <MessageBody
                      parts={parts}
                      isAssistant={message.role === "assistant"}
                      isStreaming={isStreamingMessage}
                      onApprove={(approvalId) => handleToolApproval(approvalId, true)}
                      onDeny={(approvalId) => handleToolApproval(approvalId, false)}
                    />
                    {message.role === "assistant" &&
                    !isStreamingMessage &&
                    status !== "streaming" ? (
                      <div className="orbit-ai-message-actions">
                        <button
                          type="button"
                          className="orbit-ai-action-btn"
                          aria-label="重新生成"
                          title="重新生成"
                          onClick={() => void regenerate()}
                        >
                          <ReloadIcon size="sm" />
                          <span>重新生成</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {isBusy && !hasActiveAssistantContent ? <p className="orbit-muted text-sm">思考中…</p> : null}
            </div>

            {showStreamError ? (
              <div className="orbit-ai-error">
                <p className="orbit-danger-text text-sm">{error?.message}</p>
                {configError ? (
                  <Link to="/settings?tab=ai" className="orbit-text-link text-sm">
                    前往 AI 设置
                  </Link>
                ) : null}
              </div>
            ) : null}

            <form className="orbit-ai-composer" onSubmit={(e) => void handleSubmit(e)}>
              <div className="orbit-ai-composer-card">
                {showArticleContextPill ? (
                  <div className="orbit-ai-context-pill">
                    {ContextIcon ? (
                      <ContextIcon size="sm" className="orbit-ai-context-pill-icon" />
                    ) : null}
                    <span className="orbit-ai-context-pill-label" title={contextLabel}>
                      {contextLabel}
                    </span>
                    <button
                      type="button"
                      className="orbit-ai-context-pill-dismiss"
                      aria-label="移除文章上下文"
                      title="移除文章上下文"
                      onClick={() => setContextDismissed(true)}
                    >
                      <CloseIcon size="sm" />
                    </button>
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
                    if (isMobile) return;
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSubmit(event);
                    }
                  }}
                />
                <div className="orbit-ai-composer-toolbar">
                  <AiModelPicker disabled={isBusy} onNavigateAway={onClose} />
                  <div className="flex items-center gap-1.5 shrink-0">
                    <VoiceInputButton
                      compact
                      onTextUpdate={(val) => setInput(val)}
                      onStreamStart={() => inputRef.current?.focus()}
                    />
                    {status === "streaming" ? (
                      <button
                        type="button"
                        className="orbit-ai-stop-btn"
                        aria-label="停止生成"
                        title="停止生成"
                        onClick={() => stop()}
                      >
                        <StopIcon size="sm" />
                      </button>
                    ) : (
                      <button
                        type="submit"
                        className="orbit-ai-send-btn"
                        aria-label="发送"
                        disabled={isBusy || !input.trim()}
                      >
                        <ArrowUpIcon size="sm" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </aside>
    </div>
  );
}
