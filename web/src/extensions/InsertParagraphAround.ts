import { Extension, type Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

function insertAroundTopBlock(editor: Editor, placement: "above" | "below"): boolean {
  const { state } = editor;
  const paragraphType = state.schema.nodes.paragraph;
  if (!paragraphType) return false;

  const { selection } = state;
  const { $from, $to } = selection;

  let insertPos: number;
  if ($from.depth === 0) {
    insertPos = placement === "above" ? selection.from : selection.to;
  } else {
    insertPos = placement === "above" ? $from.before(1) : $to.after(1);
  }

  const tr = state.tr.insert(insertPos, paragraphType.create());
  tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
  editor.view.dispatch(tr.scrollIntoView());
  return true;
}

export const InsertParagraphAround = Extension.create({
  name: "insertParagraphAround",

  addKeyboardShortcuts() {
    const escapeFromDocStart = ({ editor }: { editor: Editor }) => {
      const { state } = editor;
      const { selection } = state;
      if (!selection.empty) return false;

      const { $from } = selection;
      if ($from.depth < 1 || $from.pos !== $from.depth) return false;

      const firstNode = state.doc.firstChild;
      if (!firstNode || firstNode.type.name === "paragraph") return false;

      const paragraphType = state.schema.nodes.paragraph;
      if (!paragraphType) return false;

      const tr = state.tr.insert(0, paragraphType.create());
      tr.setSelection(TextSelection.create(tr.doc, 1));
      editor.view.dispatch(tr.scrollIntoView());
      return true;
    };

    return {
      ArrowUp: escapeFromDocStart,
      ArrowLeft: escapeFromDocStart,
      "Mod-Shift-Enter": ({ editor }) => insertAroundTopBlock(editor, "above"),
      "Mod-Alt-Enter": ({ editor }) => insertAroundTopBlock(editor, "below"),
    };
  },
});
