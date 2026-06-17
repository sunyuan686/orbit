import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchEntry, saveEntry, createEntry, TYPE_LABEL, getApiErrorMessage } from "../lib/api";
import { useToast } from "../lib/useToast";
import { TiptapEditor } from "../components/TiptapEditor";

export function ArticleEdit() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = id === "new";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [loaded, setLoaded] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef(body);

  useEffect(() => {
    bodyRef.current = body;
  }, [body]);

  useEffect(() => {
    if (isNew || !id) {
      setLoaded(true);
      return;
    }
    fetchEntry(id)
      .then((entry) => {
        setTitle(entry.title || "");
        setBody(entry.body);
        setLoaded(true);
      })
      .catch((err) => {
        toast.error(getApiErrorMessage(err, "加载失败，内容可能不存在"));
        setLoaded(true);
      });
  }, [id, isNew, toast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (isNew) {
        const result = await createEntry({
          type: type === "diary" ? "diary"
            : type === "message" ? "message"
            : type === "memo" ? "memo"
            : "letter",
          title,
          body: bodyRef.current,
        });
        toast.success("已创建");
        navigate(`/${type}/${result.id}`, { replace: true });
      } else {
        await saveEntry(id!, { title, body: bodyRef.current });
        toast.success("已保存");
        navigate(`/${type}/${id}`);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, "保存失败，请稍后重试"));
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p style={{ color: "var(--color-text-muted)" }}>加载中…</p>;

  return (
    <div style={{ maxWidth: "720px", margin: "0 auto" }}>
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <h2 className="orbit-page-title">
          {isNew ? `新建${TYPE_LABEL[type || ""] || ""}` : "编辑"}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => navigate(-1)} className="orbit-btn">
            取消
          </button>
          <button
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

      <TiptapEditor
        defaultValue={body}
        onChange={(val) => { bodyRef.current = val; }}
        entryId={isNew ? undefined : id}
      />
    </div>
  );
}
