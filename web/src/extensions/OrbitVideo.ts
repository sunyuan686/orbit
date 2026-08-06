import { Node, mergeAttributes } from "@tiptap/core";

export interface VideoOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string }) => ReturnType;
    };
  }
}

export const OrbitVideo = Node.create<VideoOptions>({
  name: "video",
  group: "block",
  inline: false,
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      preload: {
        default: "metadata",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "video",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          return {
            src: el.getAttribute("src"),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const videoAttrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      src: node.attrs.src,
      controls: true,
      preload: "metadata",
      class: "orbit-prose-video rounded-xl max-w-full my-3 shadow-sm border border-stone-200/50 dark:border-stone-800",
    });

    return ["video", videoAttrs];
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});
