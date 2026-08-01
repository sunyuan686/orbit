import { Extension, InputRule } from "@tiptap/core";

const MARKDOWN_LINK_INPUT_REGEX = /\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)$/;
const BARE_URL_INPUT_REGEX = /((?:https?:\/\/|mailto:|tel:)[^\s<]+)\s$/i;

function sanitizeHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (/^(?:https?:\/\/|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export const LinkInputRules = Extension.create({
  name: "linkInputRules",

  addInputRules() {
    const linkType = this.editor.schema.marks.link;
    if (!linkType) return [];

    return [
      new InputRule({
        find: MARKDOWN_LINK_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const label = match[1]?.trim();
          const href = sanitizeHref(match[2] ?? "");
          if (!label || !href) return null;

          state.tr.insertText(label, range.from, range.to);
          state.tr.addMark(range.from, range.from + label.length, linkType.create({ href }));
          state.tr.removeStoredMark(linkType);
          return null;
        },
      }),

      new InputRule({
        find: BARE_URL_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const href = sanitizeHref(match[1] ?? "");
          if (!href) return null;

          const text = match[1] + " ";
          state.tr.insertText(text, range.from, range.to);
          state.tr.addMark(range.from, range.from + match[1].length, linkType.create({ href }));
          state.tr.removeStoredMark(linkType);
          return null;
        },
      }),
    ];
  },
});
