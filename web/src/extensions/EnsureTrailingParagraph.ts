import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, TextSelection } from "@tiptap/pm/state";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

function ensureTrailingParagraphTr(state: EditorState): Transaction | null {
  const paragraph = state.schema.nodes.paragraph;
  if (!paragraph) return null;

  const lastChild = state.doc.lastChild;
  if (!lastChild || lastChild.type === paragraph) {
    return null;
  }

  return state.tr.insert(state.doc.content.size, paragraph.create());
}

function trailingParagraphCaretPos(doc: ProseMirrorNode): number {
  const last = doc.lastChild;
  if (last?.type.name === "paragraph") {
    return Math.max(1, doc.content.size - 1);
  }
  return doc.content.size;
}

function clearNodeSelectionOnOutsideClick(
  view: EditorView,
  event: MouseEvent,
): boolean {
  const { state } = view;
  if (!(state.selection instanceof NodeSelection)) {
    return false;
  }

  const target = event.target as HTMLElement;
  if (
    target.closest(
      ".tiptap-image-toolbar, .tiptap-image-caption-bar, .tiptap-image-missing",
    )
  ) {
    return false;
  }

  const nodePos = state.selection.from;
  const nodeEnd = nodePos + state.selection.node.nodeSize;
  const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });

  if (hit && hit.pos >= nodePos && hit.pos < nodeEnd) {
    return false;
  }

  let tr = ensureTrailingParagraphTr(state) ?? state.tr;
  const pos = hit
    ? Math.min(Math.max(1, hit.pos), tr.doc.content.size)
    : trailingParagraphCaretPos(tr.doc);

  try {
    tr = tr.setSelection(TextSelection.create(tr.doc, pos));
  } catch {
    tr = tr.setSelection(
      TextSelection.create(tr.doc, trailingParagraphCaretPos(tr.doc)),
    );
  }

  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/**
 * Keep an empty paragraph at the end of the document so clicks below block
 * nodes (images, etc.) can place the caret and clear node selections.
 */
export const EnsureTrailingParagraph = Extension.create({
  name: "ensureTrailingParagraph",

  onCreate({ editor }) {
    const tr = ensureTrailingParagraphTr(editor.state);
    if (tr) {
      editor.view.dispatch(tr);
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          return ensureTrailingParagraphTr(newState);
        },
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              if (event.button !== 0) return false;
              return clearNodeSelectionOnOutsideClick(view, event);
            },
          },
        },
      }),
    ];
  },
});
