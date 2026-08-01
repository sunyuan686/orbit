import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import type { Editor } from "@tiptap/core";

export function moveSelectionAfterBlockInsertion(editor: Editor) {
  const { tr, schema } = editor.state;
  const { $to } = tr.selection;
  const posAfter = $to.end();

  if ($to.nodeAfter) {
    if ($to.nodeAfter.isTextblock) {
      tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
    } else if ($to.nodeAfter.isBlock) {
      tr.setSelection(NodeSelection.create(tr.doc, $to.pos));
    } else {
      tr.setSelection(TextSelection.create(tr.doc, $to.pos));
    }
  } else {
    const paragraphType = schema.nodes.paragraph;
    const node = paragraphType?.create();
    if (node) {
      tr.insert(posAfter, node);
      tr.setSelection(TextSelection.create(tr.doc, posAfter + 1));
    }
  }

  tr.scrollIntoView();
  editor.view.dispatch(tr);
}
