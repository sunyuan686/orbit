/** Matches ``, ``, ``, etc. */
const THINK_BLOCK_RE =
  /<(?:think(?:ing)?|(?:redacted_)?thinking)>([\s\S]*?)<\/(?:think(?:ing)?|(?:redacted_)?thinking)>/gi;

/** QwQ / Workers AI sometimes omits the opening tag and only emits a closing tag. */
const LEADING_THINK_CLOSE_RE =
  /^([\s\S]*?)<\/(?:think(?:ing)?|(?:redacted_)?thinking)>\s*/i;

/** Streaming: opening tag present but block not closed yet. */
const OPEN_THINK_RE =
  /<(?:think(?:ing)?|(?:redacted_)?thinking)>([\s\S]*)$/i;

export function splitEmbeddedThinking(raw: string): {
  reasoning: string;
  text: string;
} {
  const reasoningChunks: string[] = [];
  let text = raw;

  text = text.replace(THINK_BLOCK_RE, (_, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed) reasoningChunks.push(trimmed);
    return "";
  });

  const leadingClose = text.match(LEADING_THINK_CLOSE_RE);
  if (leadingClose) {
    const trimmed = leadingClose[1].trim();
    if (trimmed) reasoningChunks.push(trimmed);
    text = text.slice(leadingClose[0].length);
  }

  const openTail = text.match(OPEN_THINK_RE);
  if (openTail) {
    const trimmed = openTail[1].trim();
    if (trimmed) reasoningChunks.push(trimmed);
    text = text.slice(0, openTail.index);
  }

  return {
    reasoning: reasoningChunks.join("\n\n").trim(),
    text: text.trim(),
  };
}

function getReasoningFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part): part is { type: string; text?: string } =>
      Boolean(part && typeof part === "object" && part.type === "reasoning")
    )
    .map((part) => part.text ?? "")
    .join("");
}

function getTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part): part is { type: string; text?: string } =>
      Boolean(part && typeof part === "object" && part.type === "text")
    )
    .map((part) => part.text ?? "")
    .join("");
}

/** User-visible reply text (strips reasoning parts and embedded think tags). */
export function extractVisibleTextFromParts(parts: unknown): string {
  const rawText = getTextFromParts(parts);
  return splitEmbeddedThinking(rawText).text;
}

export function parseAssistantParts(parts: unknown): {
  reasoning: string;
  text: string;
} {
  const partReasoning = getReasoningFromParts(parts);
  const embedded = splitEmbeddedThinking(getTextFromParts(parts));
  const reasoning = [partReasoning, embedded.reasoning]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return {
    reasoning,
    text: embedded.text,
  };
}
