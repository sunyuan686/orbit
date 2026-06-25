import { useState } from "react";

export function CommentComposer({
  placeholder,
  submitLabel,
  onSubmit,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const next = body.trim();
    if (!next || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(next);
      setBody("");
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
        <button
          type="button"
          className="orbit-btn orbit-btn-primary"
          disabled={!body.trim() || submitting}
          onClick={() => void handleSubmit()}
        >
          {submitting ? "发送中" : submitLabel}
        </button>
      </div>
    </div>
  );
}
