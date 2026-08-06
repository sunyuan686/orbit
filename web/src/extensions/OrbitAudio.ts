import { Node, mergeAttributes } from "@tiptap/core";
import "../lib/initVoiceCards";

export interface AudioOptions {
  HTMLAttributes: Record<string, any>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    audio: {
      setAudio: (options: { src: string; transcript?: string }) => ReturnType;
    };
  }
}

const WAVEFORM_HEIGHTS = [35, 50, 80, 60, 40, 90, 100, 75, 50, 65, 85, 45, 95, 70, 80, 55, 35, 90, 60, 45, 75, 85, 50, 35];

export const OrbitAudio = Node.create<AudioOptions>({
  name: "audio",
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
      transcript: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-orbit-audio]",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const audioEl = el.querySelector("audio");
          const transcriptEl = el.querySelector(".orbit-voice-transcript");
          return {
            src: el.getAttribute("data-src") || audioEl?.getAttribute("src") || "",
            transcript: el.getAttribute("data-transcript") || transcriptEl?.textContent?.trim() || null,
          };
        },
      },
      {
        tag: "div[class*=orbit-prose-audio-block]",
        getAttrs: (dom) => {
          const el = dom as HTMLElement;
          const audioEl = el.querySelector("audio");
          const transcriptEl = el.querySelector(".orbit-voice-transcript");
          return {
            src: audioEl?.getAttribute("src") || "",
            transcript: transcriptEl?.textContent?.trim() || null,
          };
        },
      },
      {
        tag: "audio",
        getAttrs: (dom) => ({
          src: (dom as HTMLElement).getAttribute("src"),
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const transcript = node.attrs.transcript;
    const src = node.attrs.src || "";

    const waveformBars: any[] = WAVEFORM_HEIGHTS.map((h) => [
      "span",
      {
        class: "orbit-voice-bar w-[3px] rounded-full bg-stone-300 dark:bg-stone-700 transition-colors",
        style: `height:${h}%`,
      },
    ]);

    const playBtnNode: any = [
      "button",
      {
        type: "button",
        class: "orbit-voice-play-btn w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer",
        title: "播放/暂停",
      },
      [
        "svg",
        { class: "w-3.5 h-3.5 fill-current ml-0.5 orbit-voice-play-icon", viewBox: "0 0 24 24" },
        ["polygon", { points: "5 3 19 12 5 21 5 3" }],
      ],
      [
        "svg",
        { class: "w-3.5 h-3.5 fill-current hidden orbit-voice-pause-icon", viewBox: "0 0 24 24" },
        ["rect", { x: "6", y: "4", width: "4", height: "16", rx: "1" }],
        ["rect", { x: "14", y: "4", width: "4", height: "16", rx: "1" }],
      ],
    ];

    const transcriptToggleNode: any = transcript
      ? [
          "button",
          {
            type: "button",
            class: "orbit-voice-transcript-toggle flex items-center gap-1 px-2 py-1 rounded-md bg-stone-200/60 dark:bg-stone-800/60 hover:bg-amber-500/10 hover:text-amber-600 text-stone-500 dark:text-stone-400 text-xs font-sans transition-colors cursor-pointer shrink-0 select-none",
            title: "展开/折叠转写文稿",
          },
          ["span", { class: "text-xs select-none" }, "💬"],
          ["span", { class: "text-[10px] font-medium" }, "文稿"],
        ]
      : null;

    const rowNodeParts: any[] = [
      playBtnNode,
      ["div", { class: "orbit-voice-waveform flex-1 min-w-0 flex items-center gap-[2.5px] h-4 cursor-pointer py-0.5" }, ...waveformBars],
      ["span", { class: "orbit-voice-time text-[11px] font-mono text-stone-500 dark:text-stone-400 shrink-0" }, "0:00"],
    ];

    if (transcriptToggleNode) {
      rowNodeParts.push(transcriptToggleNode);
    }

    const mainRowNode: any = ["div", { class: "flex items-center gap-2.5" }, ...rowNodeParts];

    const audioElNode: any = ["audio", { src, controls: true, class: "orbit-prose-audio hidden" }];

    if (transcript) {
      const transcriptNode: any = [
        "div",
        { class: "orbit-voice-transcript-block hidden mt-2 pt-2 border-t border-stone-200/60 dark:border-stone-800/80 text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-normal bg-stone-500/5 dark:bg-stone-400/5 p-2 rounded-lg" },
        ["p", { class: "orbit-voice-transcript flex-1 min-w-0 m-0 font-sans" }, transcript],
      ];

      return [
        "div",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          "data-orbit-audio": "true",
          "data-src": src,
          "data-transcript": transcript,
          class: "orbit-prose-audio-block orbit-voice-card group my-2.5 p-2.5 px-3 bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 rounded-xl shadow-xs transition-all hover:border-amber-500/30 select-none max-w-xl",
        }),
        mainRowNode,
        transcriptNode,
        audioElNode,
      ];
    }

    return [
      "div",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        "data-orbit-audio": "true",
        "data-src": src,
        class: "orbit-prose-audio-block orbit-voice-card group my-2.5 p-2.5 px-3 bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 rounded-xl shadow-xs transition-all hover:border-amber-500/30 select-none max-w-xl",
      }),
      mainRowNode,
      audioElNode,
    ];
  },

  addCommands() {
    return {
      setAudio:
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
