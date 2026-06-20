import { escapeHtml } from "./html.js";

const SEARCH_TERM_PATTERN = /[\p{L}\p{N}]+/gu;
const SNIPPET_MAX_LENGTH = 160;
const SNIPPET_CONTEXT_CHARS = 72;

function normalizeSearchTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const matchedTerms = trimmed.match(SEARCH_TERM_PATTERN) ?? [];
  const terms = matchedTerms.length > 0 ? matchedTerms : [trimmed];
  const uniqueTerms = new Set<string>();

  for (const term of terms) {
    const normalized = term.trim();
    if (normalized) uniqueTerms.add(normalized);
  }

  return [...uniqueTerms];
}

function buildHighlightPattern(terms: string[]): RegExp | null {
  if (terms.length === 0) return null;

  const escapedTerms = [...terms]
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return new RegExp(`(${escapedTerms.join("|")})`, "giu");
}

function findFirstMatchIndex(text: string, terms: string[]): number {
  const normalizedText = text.toLocaleLowerCase();
  let bestIndex = Number.POSITIVE_INFINITY;

  for (const term of terms) {
    const index = normalizedText.indexOf(term.toLocaleLowerCase());
    if (index !== -1 && index < bestIndex) bestIndex = index;
  }

  return Number.isFinite(bestIndex) ? bestIndex : -1;
}

function sliceSnippetWindow(text: string, matchIndex: number, query: string): string {
  const queryLength = [...query].length;
  const initialStart = Math.max(0, matchIndex - SNIPPET_CONTEXT_CHARS);
  const initialEnd = Math.min(
    text.length,
    matchIndex + Math.max(queryLength, 1) + SNIPPET_CONTEXT_CHARS
  );

  let start = initialStart;
  let end = initialEnd;

  if (end - start > SNIPPET_MAX_LENGTH) {
    const overflow = end - start - SNIPPET_MAX_LENGTH;
    start = Math.min(start + Math.floor(overflow / 2), matchIndex);
    end = Math.min(text.length, start + SNIPPET_MAX_LENGTH);
    if (end - start > SNIPPET_MAX_LENGTH) end = start + SNIPPET_MAX_LENGTH;
  }

  let snippet = text.slice(start, end).trim();
  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;
  return snippet;
}

export function extractSearchTerms(query: string): string[] {
  return normalizeSearchTerms(query);
}

export function highlightText(text: string, query: string): string {
  const escaped = escapeHtml(text);
  const pattern = buildHighlightPattern(normalizeSearchTerms(query));
  if (!pattern) return escaped;
  return escaped.replace(pattern, "<mark>$1</mark>");
}

export function buildSearchSnippet(
  fields: Array<string | null | undefined>,
  query: string
): string | undefined {
  const terms = normalizeSearchTerms(query);
  if (terms.length === 0) return undefined;

  for (const field of fields) {
    if (!field) continue;
    const text = field.trim();
    if (!text) continue;

    const matchIndex = findFirstMatchIndex(text, terms);
    if (matchIndex === -1) continue;

    return highlightText(sliceSnippetWindow(text, matchIndex, query), query);
  }

  return undefined;
}

export function decodeFtsSnippet(snippet: string | null | undefined): string | undefined {
  if (!snippet) return undefined;
  return escapeHtml(snippet)
    .replaceAll(String.fromCharCode(2), "<mark>")
    .replaceAll(String.fromCharCode(3), "</mark>");
}
