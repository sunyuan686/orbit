import type { UIMessage } from "ai";
import { parseAssistantParts, splitEmbeddedThinking } from "../../../src/lib/ai-message-content.ts";

export interface ParsedAssistantContent {
  reasoning: string;
  text: string;
}

export function parseAssistantContent(message: UIMessage): ParsedAssistantContent {
  return parseAssistantParts(message.parts);
}

export { splitEmbeddedThinking };

