import { Node, type Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorView } from "@tiptap/pm/view";
import { uploadImage } from "../lib/api";
import { moveSelectionAfterBlockInsertion } from "../lib/blockInsertion";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    image: {
      setImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        caption?: string;
        href?: string;
        layout?: string;
        width?: number | null;
        height?: number | null;
        blurhash?: string | null;
      }) => ReturnType;
    };
  }
}

const ICONS = {
  regular: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg>`,
  wide: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="1.5" y="4" width="13" height="8" rx="1.5"/></svg>`,
  full: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="0.75" y="3" width="14.5" height="10" rx="1"/><path d="M4 8h8M4 6l-1.5 2L4 10M12 6l1.5 2L12 10"/></svg>`,
  link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  replace: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`,
  expand: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>`,
} as const;

function openImageLightbox(src: string) {
  const dialog = document.createElement("dialog");
  dialog.className = "orbit-image-lightbox-dialog";
  dialog.setAttribute("aria-label", "图片预览");

  const content = document.createElement("div");
  content.className = "orbit-image-lightbox-content";
  content.tabIndex = -1;

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "orbit-image-lightbox-close";
  closeBtn.title = "关闭全屏预览";
  closeBtn.setAttribute("aria-label", "关闭全屏预览");
  closeBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  const imgEl = document.createElement("img");
  imgEl.src = src;
  imgEl.className = "orbit-image-lightbox-img";
  imgEl.alt = "";

  const close = () => {
    document.removeEventListener("keydown", onKeyDown);
    if (dialog.open) {
      dialog.close();
    }
    dialog.remove();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  const onDialogCancel = (e: Event) => {
    e.preventDefault();
    close();
  };

  closeBtn.addEventListener("click", close);
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog || e.target === content) {
      close();
    }
  });
  dialog.addEventListener("cancel", onDialogCancel);
  document.addEventListener("keydown", onKeyDown, true);

  content.appendChild(closeBtn);
  content.appendChild(imgEl);
  dialog.appendChild(content);
  document.body.appendChild(dialog);
  dialog.showModal();
  content.focus();
}

class ImageNodeView {
  dom: HTMLElement;

  private container: HTMLElement;
  private img: HTMLImageElement;
  private figcaption: HTMLElement;
  private toolbar: HTMLElement | null = null;
  private captionBar: HTMLElement | null = null;
  private captionInput: HTMLInputElement | null = null;
  private altBtn: HTMLButtonElement | null = null;
  private layoutBtns: Map<string, HTMLButtonElement> = new Map();

  private node: ProseMirrorNode;
  private view: EditorView;
  private editor: Editor;
  private getPos: () => number | undefined;

  private editingAlt = false;
  private currentSrc = "";

  private isExpanded = false;
  private expandOverlay: HTMLElement | null = null;
  private expandBtn: HTMLButtonElement | null = null;

  constructor(
    node: ProseMirrorNode,
    view: EditorView,
    getPos: () => number | undefined,
    editor: Editor,
  ) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.editor = editor;

    const figure = document.createElement("figure");
    figure.className = "tiptap-image-figure";
    figure.dataset.selected = "false";
    figure.dataset.editable = String(editor.isEditable);
    figure.dataset.layout = String(node.attrs.layout || "regular");
    figure.dataset.loadState = "loading";
    figure.dataset.longImage = "false";
    figure.dataset.collapsed = "false";
    this.dom = figure;

    const container = document.createElement("div");
    container.className = "tiptap-image-container";
    figure.appendChild(container);
    this.container = container;

    const img = document.createElement("img");
    img.draggable = false;
    img.addEventListener("load", () => this.setLoadState("loaded"));
    img.addEventListener("error", () => this.setLoadState("missing"));
    img.addEventListener("click", (e) => this.handleImageClick(e));
    container.appendChild(img);
    this.img = img;

    const figcaption = document.createElement("figcaption");
    figcaption.className = "tiptap-image-figcaption";
    figcaption.textContent = String(node.attrs.caption ?? "");
    figure.appendChild(figcaption);
    this.figcaption = figcaption;

    if (editor.isEditable) {
      this.buildEditControls();
    }

    this.syncImageAttrs(node);
  }

  update(node: ProseMirrorNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;

    this.syncImageAttrs(node);
    this.dom.dataset.editable = String(this.editor.isEditable);
    this.dom.dataset.layout = String(node.attrs.layout || "regular");

    const caption = String(node.attrs.caption ?? "");
    this.figcaption.textContent = caption;

    if (this.editor.isEditable) {
      this.buildEditControls();
      this.destroyExpandControls();
      this.layoutBtns.forEach((btn, value) => {
        btn.classList.toggle("is-active", value === (node.attrs.layout || "regular"));
      });
      if (this.captionInput && document.activeElement !== this.captionInput) {
        if (this.editingAlt) {
          this.captionInput.value = String(node.attrs.alt ?? "");
        } else {
          this.captionInput.value = caption;
        }
      }
    } else {
      this.destroyEditControls();
      this.dom.dataset.selected = "false";
      this.checkLongImageRatio();
    }

    return true;
  }

  selectNode() {
    if (!this.editor.isEditable) {
      this.dom.dataset.selected = "false";
      return;
    }
    this.dom.dataset.selected = "true";
  }

  deselectNode() {
    this.dom.dataset.selected = "false";
    this.editingAlt = false;
    if (this.altBtn) this.altBtn.classList.remove("is-active");
    if (this.captionInput) {
      this.captionInput.placeholder = "Add a caption…";
      this.captionInput.value = String(this.node.attrs.caption ?? "");
    }
  }

  stopEvent(event: Event): boolean {
    const target = event.target as HTMLElement;
    if (target.closest(".tiptap-image-toolbar")) return true;
    if (target.closest(".tiptap-image-caption-bar")) return true;
    if (target.closest(".tiptap-image-expand-btn")) return true;
    if (!this.editor.isEditable && (event.type === "click" || event.type === "mousedown")) {
      return true;
    }
    return false;
  }

  ignoreMutation(): boolean {
    return true;
  }

  destroy() {
    this.destroyEditControls();
    this.destroyExpandControls();
  }

  private handleImageClick(e: MouseEvent) {
    if (!this.editor.isEditable) {
      e.preventDefault();
      e.stopPropagation();
      const href = String(this.node.attrs.href ?? "");
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        const src = String(this.node.attrs.src ?? "");
        if (src) openImageLightbox(src);
      }
    }
  }

  private buildEditControls() {
    if (this.toolbar) return;

    const toolbar = document.createElement("div");
    toolbar.className = "tiptap-image-toolbar";
    this.container.appendChild(toolbar);
    this.toolbar = toolbar;

    const layouts: Array<[string, string, string]> = [
      ["regular", ICONS.regular, "Content width"],
      ["wide", ICONS.wide, "Wide — max 1200px"],
      ["full", ICONS.full, "Full width — edge to edge"],
    ];
    for (const [value, icon, title] of layouts) {
      if (this.layoutBtns.size > 0) toolbar.appendChild(this.sep());
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerHTML = icon;
      btn.title = title;
      if (value === (this.node.attrs.layout || "regular")) btn.className = "is-active";
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        this.updateAttrs({ layout: value });
      });
      toolbar.appendChild(btn);
      this.layoutBtns.set(value, btn);
    }

    toolbar.appendChild(this.sep());
    const linkBtn = this.iconBtn(ICONS.link, "Add link");
    linkBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const current = String(this.node.attrs.href ?? "");
      if (current) {
        this.updateAttrs({ href: "" });
        return;
      }
      const url = window.prompt("Enter URL");
      if (url) this.updateAttrs({ href: url });
    });
    toolbar.appendChild(linkBtn);

    toolbar.appendChild(this.sep());
    const replaceBtn = this.iconBtn(ICONS.replace, "Replace image");
    replaceBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.handleReplace();
    });
    toolbar.appendChild(replaceBtn);

    toolbar.appendChild(this.sep());
    const expandBtn = this.iconBtn(ICONS.expand, "Preview fullscreen");
    expandBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const src = String(this.node.attrs.src ?? "");
      if (src) openImageLightbox(src);
    });
    toolbar.appendChild(expandBtn);

    const captionBar = document.createElement("div");
    captionBar.className = "tiptap-image-caption-bar";
    this.dom.insertBefore(captionBar, this.figcaption);
    this.captionBar = captionBar;

    const captionInput = document.createElement("input");
    captionInput.type = "text";
    captionInput.placeholder = "Add a caption…";
    captionInput.value = String(this.node.attrs.caption ?? "");
    captionInput.addEventListener("input", () => {
      if (this.editingAlt) {
        this.updateAttrs({ alt: captionInput.value });
      } else {
        this.updateAttrs({ caption: captionInput.value });
      }
    });
    captionInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.view.focus();
      }
    });
    captionBar.appendChild(captionInput);
    this.captionInput = captionInput;

    const altBtn = document.createElement("button");
    altBtn.type = "button";
    altBtn.className = "tiptap-image-alt-btn";
    altBtn.textContent = "Alt";
    altBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.toggleAltMode();
    });
    captionBar.appendChild(altBtn);
    this.altBtn = altBtn;
  }

  private destroyEditControls() {
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
    if (this.captionBar) {
      this.captionBar.remove();
      this.captionBar = null;
    }
    this.captionInput = null;
    this.altBtn = null;
    this.layoutBtns.clear();
  }

  private sep(): HTMLElement {
    const s = document.createElement("span");
    s.className = "tiptap-toolbar-sep";
    return s;
  }

  private iconBtn(svg: string, title: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = svg;
    btn.title = title;
    return btn;
  }

  private updateAttrs(attrs: Record<string, unknown>) {
    const pos = this.getPos();
    if (pos === undefined) return;
    const tr = this.view.state.tr.setNodeMarkup(pos, undefined, {
      ...this.node.attrs,
      ...attrs,
    });
    this.view.dispatch(tr);
  }

  private syncImageAttrs(node: ProseMirrorNode) {
    const src = String(node.attrs.src ?? "");
    this.img.alt = String(node.attrs.alt ?? "");
    this.img.title = String(node.attrs.title ?? "");

    if (src !== this.currentSrc) {
      this.currentSrc = src;
      this.dom.dataset.loadState = "loading";
      this.img.setAttribute("src", src);
      this.checkCachedImageState();
      return;
    }

    this.checkCachedImageState();
  }

  private checkCachedImageState() {
    queueMicrotask(() => {
      if (!this.img.complete || this.img.getAttribute("src") !== this.currentSrc) {
        return;
      }
      this.setLoadState(this.img.naturalWidth === 0 ? "missing" : "loaded");
    });
  }

  private setLoadState(state: "loading" | "loaded" | "missing") {
    this.dom.dataset.loadState = state;
    if (state === "loaded") {
      this.checkLongImageRatio();
    }
  }

  private checkLongImageRatio() {
    if (this.editor.isEditable) {
      this.destroyExpandControls();
      this.dom.dataset.longImage = "false";
      this.dom.dataset.collapsed = "false";
      return;
    }

    const nw = this.img.naturalWidth;
    const nh = this.img.naturalHeight;
    if (nw > 0 && nh > 0) {
      const ratio = nh / nw;
      // 竖屏长图/长截图：高宽比 >= 1.5 且物理高度 >= 450px
      if (ratio >= 1.5 && nh >= 450) {
        this.dom.dataset.longImage = "true";
        if (!this.isExpanded) {
          this.dom.dataset.collapsed = "true";
        }
        this.buildExpandControls();
        return;
      }
    }

    this.dom.dataset.longImage = "false";
    this.dom.dataset.collapsed = "false";
    this.destroyExpandControls();
  }

  private buildExpandControls() {
    if (this.expandOverlay) return;

    const overlay = document.createElement("div");
    overlay.className = "tiptap-image-expand-overlay";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tiptap-image-expand-btn";
    btn.setAttribute("aria-label", "展开长图");
    btn.innerHTML = `
      <svg class="tiptap-image-expand-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
      <span class="tiptap-image-expand-label">${this.isExpanded ? "收起长图" : "展开长图"}</span>
    `;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleExpand();
    });

    overlay.appendChild(btn);
    this.container.appendChild(overlay);
    this.expandOverlay = overlay;
    this.expandBtn = btn;
  }

  private toggleExpand() {
    this.isExpanded = !this.isExpanded;
    this.dom.dataset.collapsed = this.isExpanded ? "false" : "true";

    if (this.expandBtn) {
      const label = this.expandBtn.querySelector(".tiptap-image-expand-label");
      if (label) label.textContent = this.isExpanded ? "收起长图" : "展开长图";
      this.expandBtn.classList.toggle("is-expanded", this.isExpanded);
    }
  }

  private destroyExpandControls() {
    if (this.expandOverlay) {
      this.expandOverlay.remove();
      this.expandOverlay = null;
      this.expandBtn = null;
    }
  }

  private handleReplace() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const res = await uploadImage(file);
        this.updateAttrs({
          src: res.url,
          width: res.width,
          height: res.height,
          blurhash: res.blurhash,
        });
      } catch {
        // Keep current image on upload failure.
      }
    });
    input.click();
  }

  private toggleAltMode() {
    if (!this.altBtn || !this.captionInput) return;
    this.editingAlt = !this.editingAlt;
    this.altBtn.classList.toggle("is-active", this.editingAlt);
    if (this.editingAlt) {
      this.captionInput.placeholder = "Add alt text…";
      this.captionInput.value = String(this.node.attrs.alt ?? "");
    } else {
      this.captionInput.placeholder = "Add a caption…";
      this.captionInput.value = String(this.node.attrs.caption ?? "");
    }
    this.captionInput.focus();
  }
}

export const OrbitImage = Node.create({
  name: "image",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      title: { default: "" },
      caption: { default: "" },
      href: { default: "" },
      layout: { default: "regular" },
      width: { default: null },
      height: { default: null },
      blurhash: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure[data-image]",
        getAttrs(dom) {
          const el = dom as HTMLElement;
          const img = el.querySelector("img");
          const figcaption = el.querySelector("figcaption");
          const link = el.querySelector("a");
          return {
            src: img?.getAttribute("src") ?? "",
            alt: img?.getAttribute("alt") ?? "",
            title: img?.getAttribute("title") ?? "",
            caption: figcaption?.textContent ?? "",
            href: link?.getAttribute("href") ?? "",
            layout: el.dataset.layout ?? "regular",
          };
        },
      },
      {
        tag: "figure",
        getAttrs(dom) {
          const el = dom as HTMLElement;
          const img = el.querySelector("img");
          if (!img) return false;
          const figcaption = el.querySelector("figcaption");
          const link = el.querySelector("a");
          return {
            src: img.getAttribute("src") ?? "",
            alt: img.getAttribute("alt") ?? "",
            title: img.getAttribute("title") ?? "",
            caption: figcaption?.textContent ?? "",
            href: link?.getAttribute("href") ?? "",
            layout: el.dataset.layout ?? "regular",
          };
        },
      },
      {
        tag: "img[src]",
        getAttrs(dom) {
          const el = dom as HTMLImageElement;
          return {
            src: el.getAttribute("src") ?? "",
            alt: el.getAttribute("alt") ?? "",
            title: el.getAttribute("title") ?? "",
          };
        },
      },
    ];
  },

  renderHTML({ node }) {
    const attrs: Record<string, string> = { "data-image": "" };
    if (node.attrs.layout && node.attrs.layout !== "regular") {
      attrs["data-layout"] = node.attrs.layout;
    }

    const imgAttrs: Record<string, string> = { src: node.attrs.src };
    if (node.attrs.alt) imgAttrs.alt = node.attrs.alt;
    if (node.attrs.title) imgAttrs.title = node.attrs.title;

    const imgNode: [string, Record<string, string>] = ["img", imgAttrs];
    const children: Array<string | [string, Record<string, string>] | [string, Record<string, string>, ...unknown[]]> = [];

    if (node.attrs.href) {
      children.push(["a", { href: node.attrs.href }, imgNode]);
    } else {
      children.push(imgNode);
    }

    if (node.attrs.caption) {
      children.push(["figcaption", {}, node.attrs.caption]);
    }

    return ["figure", attrs, ...children];
  },

  addCommands() {
    return {
      setImage:
        (options: {
          src: string;
          alt?: string;
          title?: string;
          caption?: string;
          href?: string;
          layout?: string;
          width?: number | null;
          height?: number | null;
          blurhash?: string | null;
        }) =>
        ({ commands, editor }) => {
          const res = commands.insertContent({
            type: this.name,
            attrs: options,
          });
          if (res) {
            window.setTimeout(() => {
              moveSelectionAfterBlockInsertion(editor);
            }, 0);
          }
          return res;
        },
    };
  },

  addNodeView() {
    return ({ node, view, getPos, editor }) => {
      return new ImageNodeView(
        node,
        view,
        getPos as () => number | undefined,
        editor,
      );
    };
  },
});
