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
  private editor: Editor;
  private getPos: () => number | undefined;

  private playIcon: SVGElement;
  private pauseIcon: SVGElement;
  private waveformEl: HTMLElement;
  private timeEl: HTMLElement;
  private transcriptToggleBtn: HTMLButtonElement;
  private transcriptBlock: HTMLElement;
  private transcriptDisplayWrapper: HTMLElement;
  private transcriptTextEl: HTMLElement;
  private transcriptEditWrapper: HTMLElement;
  private transcriptTextarea: HTMLTextAreaElement;
  private audioEl: HTMLAudioElement;
  private bars: HTMLElement[] = [];

  private isExpanded = false;

  constructor(
    node: ProseMirrorNode,
    _view: EditorView,
    getPos: () => number | undefined,
    editor: Editor
  ) {
    this.node = node;
    this.getPos = getPos;
    this.editor = editor;

    // Card Container
    const card = document.createElement("div");
    card.className = "orbit-prose-audio-block orbit-voice-card";
    card.dataset.orbitAudio = "true";
    this.dom = card;

    // ── Row 1: Audio Playback Controls ──────────────────────────────────────
    const row = document.createElement("div");
    row.className = "orbit-voice-card-main";
    card.appendChild(row);

    // Play/Pause Button
    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "orbit-voice-play-btn";
    playBtn.title = "播放/暂停";
    playBtn.innerHTML = `
      <svg class="w-3.5 h-3.5 fill-current ml-0.5 orbit-voice-play-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      <svg class="w-3.5 h-3.5 fill-current hidden orbit-voice-pause-icon" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
    `;
    this.playIcon = playBtn.querySelector(".orbit-voice-play-icon") as SVGElement;
    this.pauseIcon = playBtn.querySelector(".orbit-voice-pause-icon") as SVGElement;
    row.appendChild(playBtn);

    // Waveform
    const waveform = document.createElement("div");
    waveform.className = "orbit-voice-waveform";
    WAVEFORM_HEIGHTS.forEach((h) => {
      const bar = document.createElement("span");
      bar.className = "orbit-voice-bar";
      bar.style.height = `${h}%`;
      waveform.appendChild(bar);
      this.bars.push(bar);
    });
    this.waveformEl = waveform;
    row.appendChild(waveform);

    // Time
    const timeEl = document.createElement("span");
    timeEl.className = "orbit-voice-time";
    timeEl.textContent = "0:00";
    this.timeEl = timeEl;
    row.appendChild(timeEl);

    // Transcript Toggle Button
    const transcriptToggleBtn = document.createElement("button");
    transcriptToggleBtn.type = "button";
    transcriptToggleBtn.className = "orbit-voice-transcript-toggle";
    transcriptToggleBtn.title = "展开/折叠转写文稿";
    this.transcriptToggleBtn = transcriptToggleBtn;
    row.appendChild(transcriptToggleBtn);

    // ── Row 2: Transcript Block (Collapsible & Editable) ───────────────────
    const transcriptBlock = document.createElement("div");
    transcriptBlock.className = "orbit-voice-transcript-block hidden";
    this.transcriptBlock = transcriptBlock;
    card.appendChild(transcriptBlock);

    // Display Wrapper
    const displayWrapper = document.createElement("div");
    displayWrapper.className = "orbit-voice-transcript-display";
    this.transcriptDisplayWrapper = displayWrapper;

    const transcriptTextEl = document.createElement("p");
    transcriptTextEl.className = "orbit-voice-transcript";
    this.transcriptTextEl = transcriptTextEl;
    displayWrapper.appendChild(transcriptTextEl);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "orbit-voice-transcript-edit-btn";
    editBtn.textContent = "编辑";
    editBtn.title = "修改文字稿";
    displayWrapper.appendChild(editBtn);

    transcriptBlock.appendChild(displayWrapper);

    // Edit Wrapper (textarea + action buttons)
    const editWrapper = document.createElement("div");
    editWrapper.className = "orbit-voice-transcript-edit-form hidden flex flex-col gap-2";
    this.transcriptEditWrapper = editWrapper;

    const textarea = document.createElement("textarea");
    textarea.className = "orbit-voice-textarea";
    textarea.rows = 3;
    textarea.placeholder = "输入或修改语音转写文稿…";
    this.transcriptTextarea = textarea;
    editWrapper.appendChild(textarea);

    const editActions = document.createElement("div");
    editActions.className = "flex items-center justify-end gap-2";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "orbit-voice-cancel-btn";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", () => this.cancelEditing());

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "orbit-voice-transcript-edit-btn";
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

    // Bind playback handlers
    playBtn.addEventListener("click", () => this.togglePlay());
    waveform.addEventListener("click", (e) => this.seekWaveform(e));
    transcriptToggleBtn.addEventListener("click", () => this.toggleTranscript());
    editBtn.addEventListener("click", () => this.startEditing());

    audioEl.addEventListener("play", () => this.onPlay());
    audioEl.addEventListener("pause", () => this.onPause());
    audioEl.addEventListener("ended", () => this.onEnded());
    audioEl.addEventListener("timeupdate", () => this.onTimeUpdate());
    audioEl.addEventListener("loadedmetadata", () => this.onLoadedMetadata());

    this.syncAttrs();
  }

  private syncAttrs() {
    const src = this.node.attrs.src;
    const transcript = this.node.attrs.transcript;

    if (this.audioEl.src !== src && src) {
      this.audioEl.src = src;
    }

    if (transcript) {
      this.transcriptTextEl.textContent = transcript;
      this.transcriptToggleBtn.innerHTML = `<span class="text-xs select-none">💬</span><span class="text-[10px] font-medium">文稿</span>`;
    } else {
      this.transcriptToggleBtn.innerHTML = `<span class="text-xs select-none">＋</span><span class="text-[10px] font-medium">文稿</span>`;
      this.transcriptTextEl.textContent = "（暂无转写文稿，点击编辑添加）";
    }
  }

  private togglePlay() {
    if (!this.audioEl.src) return;
    if (this.audioEl.paused) {
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== this.audioEl && !a.paused) a.pause();
      });
      this.audioEl.play().catch(() => {});
    } else {
      this.audioEl.pause();
    }
  }

  private onPlay() {
    this.playIcon.classList.add("hidden");
    this.pauseIcon.classList.remove("hidden");
  }

  private onPause() {
    this.playIcon.classList.remove("hidden");
    this.pauseIcon.classList.add("hidden");
  }

  private onEnded() {
    this.playIcon.classList.remove("hidden");
    this.pauseIcon.classList.add("hidden");
    this.bars.forEach((bar) => bar.classList.remove("is-played"));
  }

  private onLoadedMetadata() {
    this.onTimeUpdate();
  }

  private onTimeUpdate() {
    const current = this.audioEl.currentTime || 0;
    const total = this.audioEl.duration || 0;

    this.timeEl.textContent =
      total > 0 ? `${formatTime(current)} / ${formatTime(total)}` : formatTime(current);

    if (this.bars.length > 0 && total > 0) {
      const activeCount = Math.round((current / total) * this.bars.length);
      this.bars.forEach((bar, idx) => {
        bar.classList.toggle("is-played", idx < activeCount);
      });
    }
  }

  private toggleTranscript() {
    this.isExpanded = !this.isExpanded;
    this.transcriptBlock.classList.toggle("hidden", !this.isExpanded);
    this.transcriptToggleBtn.classList.toggle("is-active", this.isExpanded);
    if (this.isExpanded) {
      if (this.editor.isEditable && !this.node.attrs.transcript) {
        this.startEditing();
      }
    } else {
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
    const newTranscript = this.transcriptTextarea.value.trim();
    const pos = typeof this.getPos === "function" ? this.getPos() : undefined;
    if (typeof pos === "number") {
      this.editor.commands.command(({ tr }) => {
        tr.setNodeMarkup(pos, undefined, {
          ...this.node.attrs,
          transcript: newTranscript || null,
        });
        return true;
      });
    }
    this.cancelEditing();
  }

  private seekWaveform(e: MouseEvent) {
    if (!this.audioEl.duration) return;
    const rect = this.waveformEl.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    this.audioEl.currentTime = ratio * this.audioEl.duration;
    if (this.audioEl.paused) {
      this.audioEl.play().catch(() => {});
    }
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.syncAttrs();
    return true;
  }

  selectNode() {
    this.dom.classList.add("is-selected");
  }

  deselectNode() {
    this.dom.classList.remove("is-selected");
  }

  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement;
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
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const transcript = node.attrs.transcript;
    const src = node.attrs.src || "";

    const waveformBars: any[] = WAVEFORM_HEIGHTS.map((h) => [
      "span",
      {
        class: "orbit-voice-bar",
        style: `height:${h}%`,
      },
    ]);

    const playBtnNode: any = [
      "button",
      {
        type: "button",
        class: "orbit-voice-play-btn",
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
            class: "orbit-voice-transcript-toggle",
            title: "展开/折叠转写文稿",
          },
          ["span", { class: "select-none" }, "💬"],
          ["span", {}, "文稿"],
        ]
      : null;

    const rowNodeParts: any[] = [
      playBtnNode,
      ["div", { class: "orbit-voice-waveform" }, ...waveformBars],
      ["span", { class: "orbit-voice-time" }, "0:00"],
    ];

    if (transcriptToggleNode) {
      rowNodeParts.push(transcriptToggleNode);
    }

    const mainRowNode: any = ["div", { class: "orbit-voice-card-main" }, ...rowNodeParts];

    const audioElNode: any = ["audio", { src, controls: true, class: "orbit-prose-audio hidden" }];

    if (transcript) {
      const transcriptNode: any = [
        "div",
        { class: "orbit-voice-transcript-block hidden" },
        ["p", { class: "orbit-voice-transcript m-0 font-sans" }, transcript],
      ];

      return [
        "div",
        mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
          "data-orbit-audio": "true",
          "data-src": src,
          "data-transcript": transcript,
          class: "orbit-prose-audio-block orbit-voice-card",
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
        class: "orbit-prose-audio-block orbit-voice-card",
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
