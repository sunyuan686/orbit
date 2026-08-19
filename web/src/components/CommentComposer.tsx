import { useState } from "react";
import { Button, Textarea } from "./ui";

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
      <Textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={3}
      />
      <div className="orbit-comment-composer-actions">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={submitting}
            onClick={onCancel}
          >
            取消
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!body.trim() || submitting}
          loading={submitting}
          onClick={() => void handleSubmit()}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
