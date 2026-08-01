import { Extension } from "@tiptap/core";

export const TabIndent = Extension.create({
  name: "tabIndent",

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
          return editor.commands.sinkListItem("listItem");
        }
        return false;
      },
      "Shift-Tab": ({ editor }) => {
        if (editor.isActive("bulletList") || editor.isActive("orderedList")) {
          return editor.commands.liftListItem("listItem");
        }
        return false;
      },
    };
  },
});
