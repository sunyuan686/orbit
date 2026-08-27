import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { MultiImageDeckNodeView, type MultiImageDeckItem } from "../components/MultiImageDeck";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    imageDeck: {
      setImageDeck: (options: { images: MultiImageDeckItem[] }) => ReturnType;
    };
  }
}

export const OrbitImageDeck = Node.create({
  name: "imageDeck",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [],
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute("data-images");
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        },
        renderHTML: (attributes: Record<string, any>) => {
          return {
            "data-images": JSON.stringify(attributes.images || []),
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-image-deck]",
      },
      {
        tag: "div[data-image-deck]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", mergeAttributes(HTMLAttributes, { "data-image-deck": "true" })];
  },

  addCommands() {
    return {
      setImageDeck:
        (options: { images: MultiImageDeckItem[] }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(MultiImageDeckNodeView);
  },
});
