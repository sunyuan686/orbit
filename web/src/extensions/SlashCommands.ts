import { Extension, type Editor, type Range } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

export type SlashCommandGroup = "media" | "structure" | "formatting" | "headings";

export interface SlashCommandItem {
  id: string;
  title: string;
  description: string;
  group: SlashCommandGroup;
  icon: string;
  command: (editor: Editor, range: Range) => void;
}

const GROUP_LABELS: Record<SlashCommandGroup, string> = {
  media: "媒体 / MEDIA",
  structure: "结构 / STRUCTURE",
  formatting: "格式 / FORMATTING",
  headings: "标题 / HEADINGS",
};

const GROUP_ORDER: SlashCommandGroup[] = ["media", "structure", "formatting", "headings"];

const DEFAULT_COMMANDS: SlashCommandItem[] = [
  {
    id: "horizontalRule",
    title: "分割线 (Divider)",
    description: "插入水平分割线",
    group: "structure",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/></svg>`,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
  {
    id: "bulletList",
    title: "无序列表 (Bullet List)",
    description: "创建列表符号项目",
    group: "formatting",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: "blockquote",
    title: "引用 (Blockquote)",
    description: "插入强调引用块",
    group: "formatting",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>`,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: "codeBlock",
    title: "代码块 (Code Block)",
    description: "插入等宽代码段落",
    group: "formatting",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
    },
  },
  {
    id: "h1",
    title: "一级标题 (Heading 1)",
    description: "插入超大主标题段落",
    group: "headings",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17 12l3-2v10"/></svg>`,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 1 }).run();
    },
  },
  {
    id: "h2",
    title: "二级标题 (Heading 2)",
    description: "插入大标题段落",
    group: "headings",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M21 18h-4c0-4 4-3 4-6 0-1.5-2-2.5-4-1"/></svg>`,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 2 }).run();
    },
  },
  {
    id: "h3",
    title: "三级标题 (Heading 3)",
    description: "插入小标题段落",
    group: "headings",
    icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h8"/><path d="M4 18V6"/><path d="M12 18V6"/><path d="M17.5 10.5c1.7-1 3.5 0 3.5 1.5a2 2 0 0 1-2 2"/><path d="M17 17.5c2 1.5 4 .3 4-1.5a2 2 0 0 0-2-2"/></svg>`,
    command: (editor, range) => {
      editor.chain().focus().deleteRange(range).toggleHeading({ level: 3 }).run();
    },
  },
];

const slashPluginKey = new PluginKey("slashCommands");

export interface SlashCommandsOptions {
  onUploadImageRequest?: () => void;
}

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: "slashCommands",

  addOptions() {
    return {
      onUploadImageRequest: undefined,
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    const onUploadImage = this.options.onUploadImageRequest;

    let menuEl: HTMLElement | null = null;
    let menuContainer: HTMLElement | null = null;
    let selectedIndex = 0;
    let filteredItems: SlashCommandItem[] = [];
    let activeRange: Range | null = null;

    function getMenuContainer(): HTMLElement {
      const dialog = editor.view.dom.closest("dialog");
      return (dialog as HTMLElement | null) ?? document.body;
    }

    function ensureMenuContainer() {
      const container = getMenuContainer();
      if (menuEl && menuContainer !== container) {
        menuEl.remove();
        menuEl = null;
      }
      menuContainer = container;
    }

    function getItems(): SlashCommandItem[] {
      const items = [...DEFAULT_COMMANDS];
      if (onUploadImage) {
        items.unshift({
          id: "image",
          title: "上传图片 (Image)",
          description: "插入本地图片文件",
          group: "media",
          icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
          command: (_ed, range) => {
            _ed.chain().focus().deleteRange(range).run();
            onUploadImage();
          },
        });
      }
      return items.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
    }

    function createMenu() {
      ensureMenuContainer();
      if (menuEl || !menuContainer) return;
      menuEl = document.createElement("div");
      menuEl.className = "orbit-slash-menu";
      menuEl.style.display = "none";
      menuContainer.appendChild(menuEl);
    }

    function scrollSelectedIntoView() {
      if (!menuEl) return;
      const scrollBody = menuEl.querySelector<HTMLElement>(".orbit-slash-menu-scroll") || menuEl;
      const selected = menuEl.querySelector<HTMLElement>(".orbit-slash-menu-item.active");
      if (!selected) return;

      const itemTop = selected.offsetTop - scrollBody.offsetTop;
      const itemBottom = itemTop + selected.offsetHeight;
      const scrollTop = scrollBody.scrollTop;
      const viewBottom = scrollTop + scrollBody.clientHeight;

      if (itemTop < scrollTop) {
        scrollBody.scrollTop = itemTop;
      } else if (itemBottom > viewBottom) {
        scrollBody.scrollTop = itemBottom - scrollBody.clientHeight;
      }
    }

    function updateSelectionState() {
      if (!menuEl) return;
      const itemsEls = menuEl.querySelectorAll<HTMLElement>(".orbit-slash-menu-item");
      itemsEls.forEach((el) => {
        const idx = parseInt(el.dataset.index || "0", 10);
        el.classList.toggle("active", idx === selectedIndex);
      });

      const activeItem = filteredItems[selectedIndex];
      const descEl = menuEl.querySelector<HTMLElement>(".orbit-slash-footer-desc");
      if (descEl) {
        descEl.textContent = activeItem?.description || "";
      }
      scrollSelectedIntoView();
    }

    function renderItems() {
      if (!menuEl) return;

      if (filteredItems.length === 0) {
        menuEl.innerHTML = `
          <div class="orbit-slash-menu-scroll">
            <div class="orbit-slash-menu-empty">无匹配命令</div>
          </div>
          <div class="orbit-slash-footer">
            <span class="orbit-slash-footer-desc">未找到符合条件的操作</span>
            <span class="orbit-slash-footer-hints">
              <span class="orbit-slash-kbd">Esc</span> 关闭
            </span>
          </div>
        `;
        return;
      }

      const groupedMarkup = GROUP_ORDER.map((groupKey) => {
        const itemsInGroup = filteredItems
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => item.group === groupKey);

        if (itemsInGroup.length === 0) return "";

        const itemsHtml = itemsInGroup
          .map(
            ({ item, index }) => `
            <button
              type="button"
              class="orbit-slash-menu-item${index === selectedIndex ? " active" : ""}"
              data-index="${index}"
            >
              <span class="orbit-slash-menu-icon">${item.icon}</span>
              <span class="orbit-slash-menu-title">${item.title}</span>
            </button>
          `
          )
          .join("");

        return `
          <div class="orbit-slash-group">
            <div class="orbit-slash-group-label">${GROUP_LABELS[groupKey]}</div>
            ${itemsHtml}
          </div>
        `;
      }).join("");

      const activeItem = filteredItems[selectedIndex];

      menuEl.innerHTML = `
        <div class="orbit-slash-menu-scroll">
          ${groupedMarkup}
        </div>
        <div class="orbit-slash-footer">
          <span class="orbit-slash-footer-desc">${activeItem?.description || ""}</span>
          <span class="orbit-slash-footer-hints">
            <span class="orbit-slash-kbd">Enter</span> 插入 · <span class="orbit-slash-kbd">Esc</span> 关闭
          </span>
        </div>
      `;

      menuEl.querySelectorAll<HTMLElement>(".orbit-slash-menu-item").forEach((btn) => {
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          const idx = parseInt(btn.dataset.index || "0", 10);
          executeItem(idx);
        });
        btn.addEventListener("mousemove", (e) => {
          if (lastMousePos && lastMousePos.x === e.clientX && lastMousePos.y === e.clientY) {
            return;
          }
          lastMousePos = { x: e.clientX, y: e.clientY };
          const idx = parseInt(btn.dataset.index || "0", 10);
          if (selectedIndex !== idx) {
            selectedIndex = idx;
            updateSelectionState();
          }
        });
      });

      scrollSelectedIntoView();
    }

    function executeItem(index: number) {
      const item = filteredItems[index];
      if (item && activeRange) {
        item.command(editor, activeRange);
        hideMenu();
      }
    }

    function updatePosition() {
      if (!menuEl || !activeRange) return;
      try {
        ensureMenuContainer();
        const container = menuContainer ?? document.body;
        const coords = editor.view.coordsAtPos(activeRange.to);
        const containerRect = container.getBoundingClientRect();
        const viewportHeight = container === document.body
          ? window.innerHeight
          : containerRect.height;
        const viewportTop = container === document.body ? 0 : containerRect.top;

        let top = coords.bottom + 6;
        const availableBelow = viewportHeight - (top - viewportTop) - 16;
        const availableAbove = coords.top - viewportTop - 16;

        let maxScrollHeight = 420;
        if (availableBelow < 280 && availableAbove > availableBelow) {
          top = Math.max(viewportTop + 12, coords.top - Math.min(availableAbove, 450) - 6);
          maxScrollHeight = Math.min(availableAbove - 42, 450);
        } else {
          maxScrollHeight = Math.min(availableBelow - 42, 450);
        }

        const scrollBody = menuEl.querySelector<HTMLElement>(".orbit-slash-menu-scroll");
        if (scrollBody) {
          scrollBody.style.maxHeight = `${Math.max(180, maxScrollHeight)}px`;
        }

        const left = coords.left - containerRect.left;
        const positionedTop = top - containerRect.top;
        const maxLeft = Math.max(12, (container === document.body ? window.innerWidth : containerRect.width) - 295);
        menuEl.style.left = `${Math.max(12, Math.min(left, maxLeft))}px`;
        menuEl.style.top = `${positionedTop}px`;
      } catch {
        hideMenu();
      }
    }

    let lastMousePos: { x: number; y: number } | null = null;

    function showMenu(query: string, range: Range) {
      createMenu();
      if (!menuEl) return;

      const isOpening = menuEl.style.display === "none";
      activeRange = range;
      const all = getItems();
      const q = query.toLowerCase().trim();
      filteredItems = q
        ? all.filter(
            (i) =>
              i.title.toLowerCase().includes(q) ||
              i.id.toLowerCase().includes(q) ||
              i.description.toLowerCase().includes(q)
          )
        : all;

      if (isOpening || selectedIndex >= filteredItems.length) {
        selectedIndex = 0;
        lastMousePos = null;
      }

      renderItems();
      menuEl.style.display = "flex";
      updatePosition();
    }

    function hideMenu() {
      if (menuEl) {
        menuEl.style.display = "none";
      }
      activeRange = null;
      selectedIndex = 0;
      lastMousePos = null;
    }

    return [
      new Plugin({
        key: slashPluginKey,
        props: {
          handleKeyDown(_view, event) {
            if (!menuEl || menuEl.style.display === "none") {
              return false;
            }

            if (event.key === "ArrowDown") {
              event.preventDefault();
              selectedIndex = (selectedIndex + 1) % Math.max(1, filteredItems.length);
              updateSelectionState();
              return true;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              selectedIndex = (selectedIndex - 1 + filteredItems.length) % Math.max(1, filteredItems.length);
              updateSelectionState();
              return true;
            }

            if (event.key === "Enter") {
              event.preventDefault();
              executeItem(selectedIndex);
              return true;
            }

            if (event.key === "Escape") {
              event.preventDefault();
              hideMenu();
              return true;
            }

            return false;
          },

          handleDOMEvents: {
            blur() {
              setTimeout(() => hideMenu(), 150);
              return false;
            },
          },
        },
        appendTransaction(_transactions, _oldState, newState) {
          if (!editor.isEditable) {
            hideMenu();
            return null;
          }

          const { selection } = newState;
          if (!selection.empty) {
            hideMenu();
            return null;
          }

          const $pos = selection.$from;
          const lineText = $pos.parent.textBetween(0, $pos.parentOffset, undefined, "\uFFFC");
          const match = lineText.match(/\/([^\s]*)$/);

          if (match) {
            const query = match[1];
            const slashPos = $pos.pos - query.length - 1;
            showMenu(query, { from: slashPos, to: $pos.pos });
          } else {
            hideMenu();
          }

          return null;
        },
        destroy() {
          if (menuEl) {
            menuEl.remove();
            menuEl = null;
          }
          menuContainer = null;
        },
      }),
    ];
  },
});
