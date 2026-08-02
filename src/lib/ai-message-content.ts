function getReasoningFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part): part is { type: string; text?: string } =>
      Boolean(part && typeof part === "object" && part.type === "reasoning")
    )
    .map((part) => part.text ?? "")
    .join("\n\n")
    .trim();
}

function getTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part): part is { type: string; text?: string } =>
      Boolean(part && typeof part === "object" && part.type === "text")
    )
    .map((part) => part.text ?? "")
    .join("\n\n")
    .trim();
}

export function parseAssistantParts(parts: unknown): {
  reasoning: string;
  text: string;
} {
  return {
    reasoning: getReasoningFromParts(parts),
    text: getTextFromParts(parts),
  };
}

/** User-visible reply text (strips reasoning parts). */
export function extractVisibleTextFromParts(parts: unknown): string {
  return parseAssistantParts(parts).text;
}
