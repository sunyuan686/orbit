import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, NodeSelection } from "@tiptap/pm/state";

const bubbleMenuPluginKey = new PluginKey("orbitBubbleMenu");

interface BubbleItem {
  id: string;
  title: string;
  icon: string;
  action: (editor: Editor) => void;
  isActive?: (editor: Editor) => boolean;
}

const ICONS = {
  bold: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H6V4h8a4 4 0 0 1 0 8"/></svg>`,
  italic: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>`,
  strike: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>`,
  code: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
  link: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  clear: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`,
};

export const BubbleMenu = Extension.create({
  name: "orbitBubbleMenu",

  addProseMirrorPlugins() {
    const editor = this.editor;

    let menuEl: HTMLElement | null = null;

    const items: BubbleItem[] = [
      {
        id: "bold",
        title: "粗体",
        icon: ICONS.bold,
        action: (ed) => ed.chain().focus().toggleBold().run(),
        isActive: (ed) => ed.isActive("bold"),
      },
      {
        id: "italic",
        title: "斜体",
        icon: ICONS.italic,
        action: (ed) => ed.chain().focus().toggleItalic().run(),
        isActive: (ed) => ed.isActive("italic"),
      },
      {
        id: "strike",
        title: "删除线",
        icon: ICONS.strike,
        action: (ed) => ed.chain().focus().toggleStrike().run(),
        isActive: (ed) => ed.isActive("strike"),
      },
      {
        id: "code",
        title: "代码",
        icon: ICONS.code,
        action: (ed) => ed.chain().focus().toggleCode().run(),
        isActive: (ed) => ed.isActive("code"),
      },
      {
        id: "link",
        title: "链接",
        icon: ICONS.link,
        action: (ed) => ed.commands.openLinkToolbar(),
        isActive: (ed) => ed.isActive("link"),
      },
      {
        id: "clear",
        title: "清除格式",
        icon: ICONS.clear,
        action: (ed) => ed.chain().focus().unsetAllMarks().clearNodes().run(),
      },
    ];

    function createMenu() {
      if (menuEl) return;
      menuEl = document.createElement("div");
      menuEl.className = "orbit-bubble-menu";
      menuEl.style.display = "none";

      items.forEach((item) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.dataset.itemId = item.id;
        btn.className = "orbit-bubble-menu-btn";
        btn.title = item.title;
        btn.innerHTML = item.icon;

        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
          item.action(editor);
        });

        menuEl?.appendChild(btn);
      });

      document.body.appendChild(menuEl);
    }

    function updateMenuState() {
      if (!menuEl) return;
      items.forEach((item) => {
        const btn = menuEl?.querySelector(`[data-item-id="${item.id}"]`);
        if (btn) {
          const active = item.isActive ? item.isActive(editor) : false;
          btn.classList.toggle("active", active);
        }
      });
    }

    function updatePosition() {
      if (!menuEl) return;
      const { selection } = editor.state;
      if (selection.empty || selection instanceof NodeSelection || !(selection instanceof TextSelection)) {
        hideMenu();
        return;
      }

      try {
        const coords = editor.view.coordsAtPos(selection.to);
        const startCoords = editor.view.coordsAtPos(selection.from);
        const menuWidth = menuEl.offsetWidth || 200;
        const menuHeight = menuEl.offsetHeight || 36;

        const centerLeft = (startCoords.left + coords.left) / 2;
        let top = startCoords.top - menuHeight - 8;
        if (top < 12) {
          top = coords.bottom + 8;
        }

        const left = Math.max(12, Math.min(centerLeft - menuWidth / 2, window.innerWidth - menuWidth - 12));
        menuEl.style.left = `${left}px`;
        menuEl.style.top = `${top}px`;
        updateMenuState();
      } catch {
        hideMenu();
      }
    }

    function showMenu() {
      createMenu();
      if (!menuEl) return;
      menuEl.style.display = "flex";
      updatePosition();
    }

    function hideMenu() {
      if (menuEl) {
        menuEl.style.display = "none";
      }
    }

    return [
      new Plugin({
        key: bubbleMenuPluginKey,
        props: {
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
          // ONLY show BubbleMenu if selection is a TextSelection with highlighted text!
          if (selection.empty || selection instanceof NodeSelection || !(selection instanceof TextSelection)) {
            hideMenu();
            return null;
          }

          showMenu();
          return null;
        },
        destroy() {
          if (menuEl && menuEl.parentNode) {
            menuEl.parentNode.removeChild(menuEl);
            menuEl = null;
          }
        },
      }),
    ];
  },
});
