import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
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

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

class AudioNodeView {
  dom: HTMLElement;
  private node: ProseMirrorNode;
  private view: EditorView;
  private editor: Editor;
  private getPos: () => number | undefined;

  private playBtn: HTMLButtonElement;
  private playIcon: SVGElement;
  private pauseIcon: SVGElement;
  private waveformEl: HTMLElement;
  private timeEl: HTMLElement;
  private transcriptToggleBtn: HTMLButtonElement;
  private transcriptBlock: HTMLElement;
  private transcriptDisplayWrapper: HTMLElement;
  private transcriptTextEl: HTMLElement;
  private transcriptEditBtn: HTMLButtonElement;
  private transcriptEditWrapper: HTMLElement;
  private transcriptTextarea: HTMLTextAreaElement;
  private audioEl: HTMLAudioElement;
  private bars: HTMLElement[] = [];

  private isExpanded = false;

  constructor(
    node: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
    editor: Editor
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.editor = editor;

    // Card Container
    const card = document.createElement("div");
    card.className =
      "orbit-prose-audio-block orbit-voice-card group my-2.5 p-2.5 px-3 bg-stone-50 dark:bg-stone-900/60 border border-stone-200/80 dark:border-stone-800 rounded-xl shadow-xs transition-all hover:border-amber-500/30 select-none max-w-xl";
    card.dataset.orbitAudio = "true";
    this.dom = card;

    // ── Row 1: Audio Playback Controls ──────────────────────────────────────
    const row = document.createElement("div");
    row.className = "flex items-center gap-2.5";
    card.appendChild(row);

    // Play/Pause Button
    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className =
      "orbit-voice-play-btn w-8 h-8 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer";
    playBtn.title = "播放/暂停";
    playBtn.innerHTML = `
      <svg class="w-3.5 h-3.5 fill-current ml-0.5 orbit-voice-play-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <svg class="w-3.5 h-3.5 fill-current hidden orbit-voice-pause-icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
    `;
    this.playBtn = playBtn;
    this.playIcon = playBtn.querySelector(".orbit-voice-play-icon") as SVGElement;
    this.pauseIcon = playBtn.querySelector(".orbit-voice-pause-icon") as SVGElement;
    row.appendChild(playBtn);

    // Waveform
    const waveform = document.createElement("div");
    waveform.className =
      "orbit-voice-waveform flex-1 min-w-0 flex items-center gap-[2.5px] h-4 cursor-pointer py-0.5";
    WAVEFORM_HEIGHTS.forEach((h) => {
      const bar = document.createElement("span");
      bar.className =
        "orbit-voice-bar w-[3px] rounded-full bg-stone-300 dark:bg-stone-700 transition-colors";
      bar.style.height = `${h}%`;
      waveform.appendChild(bar);
      this.bars.push(bar);
    });
    this.waveformEl = waveform;
    row.appendChild(waveform);

    // Time
    const timeEl = document.createElement("span");
    timeEl.className =
      "orbit-voice-time text-[11px] font-mono text-stone-500 dark:text-stone-400 shrink-0";
    timeEl.textContent = "0:00";
    this.timeEl = timeEl;
    row.appendChild(timeEl);

    // Transcript Toggle Button
    const transcriptToggleBtn = document.createElement("button");
    transcriptToggleBtn.type = "button";
    transcriptToggleBtn.className =
      "orbit-voice-transcript-toggle flex items-center gap-1 px-2 py-1 rounded-md bg-stone-200/60 dark:bg-stone-800/60 hover:bg-amber-500/10 hover:text-amber-600 text-stone-500 dark:text-stone-400 text-xs font-sans transition-colors cursor-pointer shrink-0 select-none";
    transcriptToggleBtn.title = "展开/折叠转写文稿";
    this.transcriptToggleBtn = transcriptToggleBtn;
    row.appendChild(transcriptToggleBtn);

    // ── Row 2: Transcript Block (Collapsible & Editable) ───────────────────
    const transcriptBlock = document.createElement("div");
    transcriptBlock.className =
      "orbit-voice-transcript-block hidden mt-2 pt-2 border-t border-stone-200/60 dark:border-stone-800/80 text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-normal bg-stone-500/5 dark:bg-stone-400/5 p-2.5 rounded-lg";
    this.transcriptBlock = transcriptBlock;
    card.appendChild(transcriptBlock);

    // Display Wrapper
    const displayWrapper = document.createElement("div");
    displayWrapper.className = "orbit-voice-transcript-display flex items-start gap-2 justify-between";
    this.transcriptDisplayWrapper = displayWrapper;

    const transcriptTextEl = document.createElement("p");
    transcriptTextEl.className = "orbit-voice-transcript flex-1 min-w-0 m-0 font-sans whitespace-pre-wrap break-words";
    this.transcriptTextEl = transcriptTextEl;
    displayWrapper.appendChild(transcriptTextEl);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className =
      "orbit-voice-transcript-edit-btn shrink-0 text-[11px] px-1.5 py-0.5 rounded text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 transition-colors cursor-pointer font-medium";
    editBtn.textContent = "编辑";
    editBtn.title = "修改文字稿";
    this.transcriptEditBtn = editBtn;
    displayWrapper.appendChild(editBtn);

    transcriptBlock.appendChild(displayWrapper);

    // Edit Wrapper (textarea + action buttons)
    const editWrapper = document.createElement("div");
    editWrapper.className = "orbit-voice-transcript-edit-form hidden flex flex-col gap-2";
    this.transcriptEditWrapper = editWrapper;

    const textarea = document.createElement("textarea");
    textarea.className =
      "w-full text-xs p-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 resize-y focus:outline-none focus:ring-1 focus:ring-amber-500 font-sans leading-relaxed";
    textarea.rows = 3;
    textarea.placeholder = "输入或修改语音转写文稿…";
    this.transcriptTextarea = textarea;
    editWrapper.appendChild(textarea);

    const editActions = document.createElement("div");
    editActions.className = "flex items-center justify-end gap-2";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className =
      "px-2 py-1 text-xs rounded text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => this.cancelEditing());

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className =
      "px-2.5 py-1 text-xs rounded bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-xs transition-colors cursor-pointer";
    saveBtn.textContent = "完成";
    saveBtn.addEventListener("click", () => this.saveEditing());

    editActions.appendChild(cancelBtn);
    editActions.appendChild(saveBtn);
    editWrapper.appendChild(editActions);

    transcriptBlock.appendChild(editWrapper);

    // Hidden native audio element
    const audioEl = document.createElement("audio");
    audioEl.className = "orbit-prose-audio hidden";
    audioEl.controls = true;
    this.audioEl = audioEl;
    card.appendChild(audioEl);

    // ── Bind Events ─────────────────────────────────────────────────────────
    this.bindEvents();
    this.syncAttrs();
  }

  private bindEvents() {
    // Play / Pause
    this.playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePlay();
    });

    // Seek Waveform
    this.waveformEl.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!this.audioEl.duration) return;
      const rect = this.waveformEl.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      this.audioEl.currentTime = ratio * this.audioEl.duration;
      if (this.audioEl.paused) {
        this.audioEl.play().catch(() => {});
      }
    });

    // Toggle Transcript
    this.transcriptToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleTranscript();
    });

    // Enter Edit Mode
    this.transcriptEditBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.startEditing();
    });

    // Textarea Keyboard Shortcuts (Cmd+Enter or Ctrl+Enter to save, Esc to cancel)
    this.transcriptTextarea.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        this.saveEditing();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.cancelEditing();
      }
    });

    // Audio State Sync
    this.audioEl.addEventListener("timeupdate", () => this.updateAudioUI());
    this.audioEl.addEventListener("play", () => this.updateAudioUI());
    this.audioEl.addEventListener("pause", () => this.updateAudioUI());
    this.audioEl.addEventListener("ended", () => {
      this.audioEl.currentTime = 0;
      this.updateAudioUI();
    });
  }

  private togglePlay() {
    if (this.audioEl.paused) {
      // Pause other playing audios
      document.querySelectorAll(".orbit-voice-card audio").forEach((el) => {
        const other = el as HTMLAudioElement;
        if (other !== this.audioEl && !other.paused) {
          other.pause();
        }
      });
      this.audioEl.play().catch((err) => console.error("Audio playback failed:", err));
    } else {
      this.audioEl.pause();
    }
  }

  private updateAudioUI() {
    const isPlaying = !this.audioEl.paused;
    const current = this.audioEl.currentTime || 0;
    const total = this.audioEl.duration || 0;

    if (isPlaying) {
      this.playIcon.classList.add("hidden");
      this.pauseIcon.classList.remove("hidden");
    } else {
      this.playIcon.classList.remove("hidden");
      this.pauseIcon.classList.add("hidden");
    }

    this.timeEl.textContent =
      total > 0 ? `${formatTime(current)} / ${formatTime(total)}` : formatTime(current);

    if (this.bars.length > 0 && total > 0) {
      const activeCount = Math.round((current / total) * this.bars.length);
      this.bars.forEach((bar, idx) => {
        if (idx < activeCount) {
          bar.classList.add("bg-amber-500");
          bar.classList.remove("bg-stone-300", "dark:bg-stone-700");
        } else {
          bar.classList.remove("bg-amber-500");
          bar.classList.add("bg-stone-300", "dark:bg-stone-700");
        }
      });
    }
  }

  private toggleTranscript() {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.transcriptBlock.classList.remove("hidden");
      this.transcriptToggleBtn.classList.add("bg-amber-500/20", "text-amber-600", "dark:text-amber-400");
      // If editable and empty transcript, automatically enter edit mode
      if (this.editor.isEditable && !this.node.attrs.transcript) {
        this.startEditing();
      }
    } else {
      this.transcriptBlock.classList.add("hidden");
      this.transcriptToggleBtn.classList.remove("bg-amber-500/20", "text-amber-600", "dark:text-amber-400");
      this.cancelEditing();
    }
  }

  private startEditing() {
    if (!this.editor.isEditable) return;
    this.transcriptTextarea.value = this.node.attrs.transcript || "";
    this.transcriptDisplayWrapper.classList.add("hidden");
    this.transcriptEditWrapper.classList.remove("hidden");
    setTimeout(() => {
      this.transcriptTextarea.focus();
      this.transcriptTextarea.select();
    }, 0);
  }

  private cancelEditing() {
    this.transcriptEditWrapper.classList.add("hidden");
    this.transcriptDisplayWrapper.classList.remove("hidden");
  }

  private saveEditing() {
    const newText = this.transcriptTextarea.value.trim();
    const pos = this.getPos();
    if (typeof pos === "number") {
      const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        transcript: newText || null,
      });
      this.view.dispatch(tr);
    }
    this.cancelEditing();
  }

  private syncAttrs() {
    const src = this.node.attrs.src || "";
    const transcript = this.node.attrs.transcript || null;
    const isEditable = this.editor.isEditable;

    this.dom.dataset.src = src;
    if (transcript) {
      this.dom.dataset.transcript = transcript;
    } else {
      delete this.dom.dataset.transcript;
    }

    if (this.audioEl.src !== src) {
      this.audioEl.src = src;
    }

    // Toggle button UI
    if (transcript) {
      this.transcriptToggleBtn.innerHTML = `<span class="text-xs select-none">💬</span><span class="text-[10px] font-medium">文稿</span>`;
      this.transcriptToggleBtn.classList.remove("hidden");
      this.transcriptTextEl.textContent = transcript;
    } else if (isEditable) {
      this.transcriptToggleBtn.innerHTML = `<span class="text-xs select-none">＋</span><span class="text-[10px] font-medium">文稿</span>`;
      this.transcriptToggleBtn.classList.remove("hidden");
      this.transcriptTextEl.textContent = "（暂无转写文稿，点击编辑添加）";
    } else {
      this.transcriptToggleBtn.classList.add("hidden");
      this.transcriptBlock.classList.add("hidden");
      this.isExpanded = false;
    }

    // Edit button visibility
    if (isEditable) {
      this.transcriptEditBtn.classList.remove("hidden");
    } else {
      this.transcriptEditBtn.classList.add("hidden");
      this.cancelEditing();
    }
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.syncAttrs();
    return true;
  }

  selectNode() {
    this.dom.classList.add("ring-2", "ring-amber-500/40");
  }

  deselectNode() {
    this.dom.classList.remove("ring-2", "ring-amber-500/40");
  }

  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement;
    // Don't let ProseMirror intercept clicks/typing on buttons or textarea
    if (
      target.closest(".orbit-voice-play-btn") ||
      target.closest(".orbit-voice-waveform") ||
      target.closest(".orbit-voice-transcript-toggle") ||
      target.closest(".orbit-voice-transcript-block")
    ) {
      return true;
    }
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy() {
    if (!this.audioEl.paused) {
      this.audioEl.pause();
    }
  }
}

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

  addNodeView() {
    return ({ node, view, getPos, editor }) => {
      return new AudioNodeView(
        node,
        view,
        getPos as () => number | undefined,
        editor
      );
    };
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
