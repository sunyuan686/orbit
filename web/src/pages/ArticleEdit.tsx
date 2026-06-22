import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { authClient, fetchEntry, saveEntry, createEntry, TYPE_LABEL, getApiErrorMessage, shouldToastApiError } from "../lib/api";
import { isEmptyBody } from "../lib/content";
import { setPageTitle } from "../lib/pageTitle";
import { CANONICAL_AUTHORS } from "../lib/authors";
import { useToast } from "../lib/useToast";
import { TiptapEditor } from "../components/TiptapEditor";

function resolveEditorAuthor(
  entryAuthor: string | null | undefined,
  sessionName: string | undefined
): string | null {
  if (entryAuthor && CANONICAL_AUTHORS.includes(entryAuthor as (typeof CANONICAL_AUTHORS)[number])) {
    return entryAuthor;
  }
  if (sessionName && CANONICAL_AUTHORS.includes(sessionName as (typeof CANONICAL_AUTHORS)[number])) {
    return sessionName;
  }
  return null;
}

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
    fetchEntry(id)
      .then((entry) => {
        setTitle(entry.title || "");
        setBody(entry.body);
        setEntryAuthor(entry.author);
        if (entry.entryDate) setEntryDate(entry.entryDate);
        setLoaded(true);
      })
      .catch((err) => {
        if (shouldToastApiError(err)) {
          toast.error(getApiErrorMessage(err, "加载失败，内容可能不存在"));
        }
        setLoaded(true);
      });
  }, [id, isNew, toast]);

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
        await saveEntry(id!, {
          title,
          body: bodyRef.current,
          entryDate: isMemo ? undefined : entryDate,
        });
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

  if (!loaded) return <p style={{ color: "var(--color-text-muted)" }}>加载中…</p>;

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="orbit-page-title">
            {isNew ? `新建${TYPE_LABEL[type || ""] || ""}` : "编辑"}
          </h2>
          {displayAuthor && (
            <p className="orbit-entry-date" style={{ marginTop: "0.25rem" }}>
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
            style={{ opacity: saving ? 0.6 : 1 }}
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
        style={{
          width: "100%",
          marginBottom: "1rem",
          padding: "0.625rem 0.875rem",
          fontSize: "var(--type-title)",
          fontFamily: "var(--font-heading)",
          fontWeight: 400,
          border: "none",
          borderBottom: "1px solid var(--color-border-light)",
          background: "transparent",
          color: "var(--color-text-primary)",
          outline: "none",
          lineHeight: "var(--leading-heading)",
        }}
      />

      {!isMemo && (
        <div style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label
            htmlFor="entry-date"
            style={{ color: "var(--color-text-muted)", fontSize: "var(--type-secondary)" }}
          >
            日期
          </label>
          <input
            id="entry-date"
            type="date"
            value={toDateInput(entryDate)}
            onChange={(e) => setEntryDate(fromDateInput(e.target.value))}
            style={{
              padding: "0.375rem 0.625rem",
              fontSize: "var(--type-secondary)",
              fontFamily: "var(--font-body)",
              border: "1px solid var(--color-border-light)",
              borderRadius: "0.375rem",
              background: "transparent",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
        </div>
      )}

      <TiptapEditor
        defaultValue={body}
        onChange={(val) => { bodyRef.current = val; }}
        entryId={isNew ? undefined : id}
      />
    </div>
  );
}
