import { useEffect, useRef, useState } from "react";

export function InlineMarginaliaPopover({
  authorName,
  onSubmit,
  onCancel,
}: {
  authorName?: string | null;
  onSubmit: (body: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initial = authorName?.trim().charAt(0) || "?";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  async function handleSubmit() {
    const next = body.trim();
    if (!next || submitting) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(next);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="orbit-inline-marginalia-popover"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <span className="orbit-inline-marginalia-popover-avatar" aria-hidden>
        {initial}
      </span>
      <textarea
        ref={inputRef}
        className="orbit-inline-marginalia-popover-input"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="写边注…"
        rows={1}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
          }
        }}
      />
      <button
        type="button"
        className="orbit-inline-marginalia-popover-submit"
        disabled={!body.trim() || submitting}
        aria-label="添加边注"
        onClick={() => void handleSubmit()}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden>
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
