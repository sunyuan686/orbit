import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { fetchEntry, saveEntry, createEntry, TYPE_LABEL } from "../lib/api";
import { TiptapEditor } from "../components/TiptapEditor";

export function ArticleEdit() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const navigate = useNavigate();
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
    fetchEntry(id).then((entry) => {
      setTitle(entry.title || "");
      setBody(entry.body);
      setLoaded(true);
    });
  }, [id, isNew]);

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
        navigate(`/${type}/${result.id}`, { replace: true });
      } else {
        await saveEntry(id!, { title, body: bodyRef.current });
        navigate(`/${type}/${id}`);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p className="text-stone-400">加载中...</p>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">
          {isNew ? `新建${TYPE_LABEL[type || ""] || ""}` : "编辑"}
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm border border-stone-300 dark:border-stone-600 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-800 rounded-lg hover:bg-stone-700 dark:hover:bg-stone-300 disabled:opacity-50 transition-colors"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="标题"
        className="w-full mb-4 px-4 py-3 text-lg border border-stone-200 dark:border-stone-700 rounded-lg bg-white dark:bg-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-300 dark:focus:ring-stone-600 text-base"
      />

      <TiptapEditor
        defaultValue={body}
        onChange={(val) => { bodyRef.current = val; }}
        entryId={isNew ? undefined : id}
      />
    </div>
  );
}
