import { useState } from "react";

export function CommentComposer({
  placeholder,
  submitLabel,
  onSubmit,
  initialBody = "",
  onCancel,
  clearOnSubmit = true,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
  initialBody?: string;
  onCancel?: () => void;
  clearOnSubmit?: boolean;
}) {
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const next = body.trim();
    if (!next || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(next);
      if (clearOnSubmit) {
        setBody("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="orbit-comment-composer">
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <div className="orbit-comment-composer-actions">
        {onCancel && (
          <button
            type="button"
            className="orbit-btn"
            disabled={submitting}
            onClick={onCancel}
          >
            取消
          </button>
        )}
        <button
          type="button"
          className="orbit-btn orbit-btn-primary"
          disabled={!body.trim() || submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? (submitLabel === "保存" ? "保存中" : "发送中") : submitLabel}
        </button>
      </div>
    </div>
  );
}
