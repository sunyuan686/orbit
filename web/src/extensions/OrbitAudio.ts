import { Node, mergeAttributes, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { resolveAudioDuration } from "../lib/audioUtils";
import { ORBIT_ALLOW_DOC_CHANGE } from "./ReadonlyGuard";

export interface AudioOptions {
  HTMLAttributes: Record<string, any>;
  canEdit?: boolean | (() => boolean);
  onSaveTranscript?: (options: {
    src: string;
    transcript: string;
    nodePos?: number;
    html?: string;
  }) => Promise<void> | void;
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
  private options?: AudioOptions;

  private playIcon: SVGElement;
  private pauseIcon: SVGElement;
  private waveformEl: HTMLElement;
  private timeEl: HTMLElement;
  private transcriptToggleBtn: HTMLButtonElement;
  private transcriptBlock: HTMLElement;
  private transcriptDisplayWrapper: HTMLElement;
  private transcriptTextEl: HTMLElement;
  private editBtn: HTMLButtonElement;
  private transcriptEditWrapper: HTMLElement;
  private transcriptTextarea: HTMLTextAreaElement;
  private saveBtn: HTMLButtonElement;
  private audioEl: HTMLAudioElement;
  private bars: HTMLElement[] = [];

  private isExpanded = false;
  private isSaving = false;

  constructor(
    node: ProseMirrorNode,
    _view: EditorView,
    getPos: () => number | undefined,
    editor: Editor,
    options?: AudioOptions
  ) {
    this.node = node;
    this.getPos = getPos;
    this.editor = editor;
    this.options = options;

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
    this.editBtn = editBtn;
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
    textarea.addEventListener("click", (e) => e.stopPropagation());
    textarea.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        void this.saveEditing();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.cancelEditing();
      }
    });
    editWrapper.appendChild(textarea);

    const editActions = document.createElement("div");
    editActions.className = "flex items-center justify-end gap-2";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "orbit-voice-cancel-btn";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.cancelEditing();
    });

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "orbit-voice-transcript-edit-btn";
    saveBtn.textContent = "完成";
    this.saveBtn = saveBtn;
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.saveEditing();
    });

    editActions.appendChild(cancelBtn);
    editActions.appendChild(saveBtn);
    editWrapper.appendChild(editActions);

    transcriptBlock.appendChild(editWrapper);

    // Hidden native audio element
    const audioEl = document.createElement("audio");
    audioEl.className = "orbit-prose-audio hidden";
    audioEl.controls = true;
    audioEl.preload = "metadata";
    this.audioEl = audioEl;
    card.appendChild(audioEl);

    // Bind playback handlers with event encapsulation
    playBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.togglePlay();
    });
    waveform.addEventListener("click", (e) => {
      e.stopPropagation();
      this.seekWaveform(e);
    });
    transcriptToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleTranscript();
    });
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.startEditing();
    });

    audioEl.addEventListener("play", () => this.onPlay());
    audioEl.addEventListener("pause", () => this.onPause());
    audioEl.addEventListener("ended", () => this.onEnded());
    audioEl.addEventListener("timeupdate", () => this.onTimeUpdate());
    audioEl.addEventListener("loadedmetadata", () => this.onLoadedMetadata());

    this.syncAttrs();
  }

  private canUserEdit(): boolean {
    if (typeof this.options?.canEdit === "function") {
      return this.options.canEdit();
    }
    if (typeof this.options?.canEdit === "boolean") {
      return this.options.canEdit;
    }
    return this.editor.isEditable;
  }

  private syncAttrs() {
    const src = this.node.attrs.src;
    const transcript = this.node.attrs.transcript;
    const canEdit = this.canUserEdit();

    if (this.audioEl.src !== src && src) {
      this.audioEl.src = src;
    }

    if (transcript) {
      this.transcriptTextEl.textContent = transcript;
      this.transcriptToggleBtn.innerHTML = `<svg class="w-3.5 h-3.5 stroke-current fill-none select-none" viewBox="0 0 24 24" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg><span class="text-[10px] font-medium">文稿</span>`;
    } else {
      this.transcriptToggleBtn.innerHTML = `<span class="text-xs select-none">＋</span><span class="text-[10px] font-medium">文稿</span>`;
      this.transcriptTextEl.textContent = canEdit
        ? "（暂无转写文稿，点击编辑添加）"
        : "（暂无转写文稿）";
    }

    if (canEdit) {
      this.editBtn.classList.remove("hidden");
    } else {
      this.editBtn.classList.add("hidden");
      this.cancelEditing();
    }
  }

  private togglePlay() {
    if (!this.audioEl.src) return;
    if (this.audioEl.paused) {
      document.querySelectorAll("audio").forEach((a) => {
        if (a !== this.audioEl && !a.paused) a.pause();
      });
      this.audioEl.play().catch((err) => console.error("Audio play failed:", err));
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
    this.audioEl.currentTime = 0;
    this.onTimeUpdate();
  }

  private onLoadedMetadata() {
    resolveAudioDuration(this.audioEl, () => {
      this.onTimeUpdate();
    });
    this.onTimeUpdate();
  }

  private onTimeUpdate() {
    const current = this.audioEl.currentTime || 0;
    const total = this.audioEl.duration || 0;
    const isFiniteTotal = typeof total === "number" && isFinite(total) && total > 0;

    this.timeEl.textContent = isFiniteTotal
      ? `${formatTime(current)} / ${formatTime(total)}`
      : formatTime(current);

    if (this.bars.length > 0 && isFiniteTotal) {
      const progressRatio = Math.min(1, Math.max(0, current / total));
      const activeCount = Math.round(progressRatio * this.bars.length);
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
      if (this.canUserEdit() && !this.node.attrs.transcript) {
        this.startEditing();
      }
    } else {
      this.cancelEditing();
    }
  }

  private startEditing() {
    if (!this.canUserEdit()) return;
    this.transcriptTextarea.value = this.node.attrs.transcript || "";
    this.transcriptDisplayWrapper.classList.add("hidden");
    this.transcriptEditWrapper.classList.remove("hidden");
    setTimeout(() => {
      this.transcriptTextarea.focus();
      this.transcriptTextarea.select();
    }, 0);
  }

  private cancelEditing() {
    if (this.isSaving) return;
    this.transcriptEditWrapper.classList.add("hidden");
    this.transcriptDisplayWrapper.classList.remove("hidden");
  }

  private async saveEditing() {
    if (this.isSaving) return;
    const newTranscript = this.transcriptTextarea.value.trim();
    const pos = typeof this.getPos === "function" ? this.getPos() : undefined;

    // 1. 如果有外部 onSaveTranscript 钩子（例如详情页原地修改）
    if (this.options?.onSaveTranscript) {
      try {
        this.isSaving = true;
        this.saveBtn.textContent = "保存中…";
        this.saveBtn.disabled = true;

        if (typeof pos === "number") {
          const tr = this.editor.view.state.tr.setNodeMarkup(pos, undefined, {
            ...this.node.attrs,
            transcript: newTranscript || null,
          });
          tr.setMeta(ORBIT_ALLOW_DOC_CHANGE, true);
          this.editor.view.dispatch(tr);
          const nextNode = this.editor.view.state.doc.nodeAt(pos);
          if (nextNode) {
            this.node = nextNode;
          }
        }
        this.syncAttrs();

        await this.options.onSaveTranscript({
          src: this.node.attrs.src || "",
          transcript: newTranscript,
          nodePos: pos,
          html: this.editor.getHTML(),
        });
      } catch (err) {
        console.error("Failed to save audio transcript:", err);
      } finally {
        this.isSaving = false;
        this.saveBtn.textContent = "完成";
        this.saveBtn.disabled = false;
      }
      this.cancelEditing();
      return;
    }

    // 2. 编辑器常规保存（通过 ProseMirror 事务更新节点属性并触发 onChange）
    if (typeof pos === "number") {
      const tr = this.editor.view.state.tr.setNodeMarkup(pos, undefined, {
        ...this.node.attrs,
        transcript: newTranscript || null,
      });
      this.editor.view.dispatch(tr);
      const nextNode = this.editor.view.state.doc.nodeAt(pos);
      if (nextNode) {
        this.node = nextNode;
      }
      this.syncAttrs();
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
      {
        tag: "audio",
        getAttrs: (dom) => {
          const el = dom as HTMLAudioElement;
          if (el.closest("div[data-orbit-audio]")) {
            return false;
          }
          const src =
            el.getAttribute("src") ||
            el.querySelector("source")?.getAttribute("src") ||
            "";
          if (!src) return false;
          return {
            src,
            transcript: el.getAttribute("data-transcript") || null,
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
          [
            "svg",
            {
              class: "w-3.5 h-3.5 stroke-current fill-none select-none",
              viewBox: "0 0 24 24",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
            },
            [
              "path",
              {
                d: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
              },
            ],
          ],
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

    const audioElNode: any = ["audio", { src, controls: true, preload: "metadata", class: "orbit-prose-audio hidden" }];

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
        editor,
        this.options
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
