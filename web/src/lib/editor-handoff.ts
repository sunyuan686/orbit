import type { JSONContent } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

export interface EditorSelection {
  from: number;
  to: number;
}

export interface EditorHandoffState {
  json: JSONContent;
  html: string;
  selection: EditorSelection | null;
}

export interface EditorFullscreenCloseDetail {
  json: JSONContent;
  html: string;
  title: string;
  selection: EditorSelection | null;
}

export function clampEditorSelection(
  editor: Editor,
  selection: EditorSelection,
): EditorSelection {
  const max = editor.state.doc.content.size;
  const from = Math.max(1, Math.min(selection.from, max));
  const to = Math.max(from, Math.min(selection.to, max));
  return { from, to };
}

export function emptyDocJson(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}
