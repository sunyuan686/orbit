import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, NodeSelection } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";

const linkToolbarPluginKey = new PluginKey("linkToolbar");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    linkToolbar: {
      openLinkToolbar: () => ReturnType;
    };
  }
}

interface LinkRange {
  from: number;
  to: number;
  href: string;
  text: string;
}

function getLinkRange(state: EditorState): LinkRange | null {
  const { selection } = state;
  const linkType = state.schema.marks.link;
  if (!linkType) return null;

  // Never open link toolbar on NodeSelection (e.g. selecting an Image node)
  if (selection instanceof NodeSelection) {
    return null;
  }

  // Caret selection (empty selection)
  if (selection.empty) {
    const $pos = selection.$from;
    const marks = $pos.marks();
    const linkMark = marks.find((m) => m.type === linkType);
    if (!linkMark) return null;

    const parent = $pos.parent;
    const parentOffset = $pos.start();
    let from = 0;
    let to = 0;
    let found = false;
    let offset = 0;

    for (let i = 0; i < parent.childCount; i++) {
      const child = parent.child(i);
      const childFrom = parentOffset + offset;
      const childTo = childFrom + child.nodeSize;

      if (child.marks.some((m) => m.type === linkType && m.attrs.href === linkMark.attrs.href)) {
        if (!found) {
          from = childFrom;
          found = true;
        }
        to = childTo;
      } else if (found) {
        break;
      }
      offset += child.nodeSize;
    }

    if (!found) return null;
    const text = state.doc.textBetween(from, to, " ");
    return { from, to, href: (linkMark.attrs.href as string) || "", text };
  }

  // Range selection (TextSelection) -> only show if selected range actually has a link mark!
  const from = selection.from;
  const to = selection.to;
  const hasLinkMark = state.doc.rangeHasMark(from, to, linkType);
  if (!hasLinkMark) return null;

  const mark = selection.$from.marks().find((m) => m.type === linkType);
  const text = state.doc.textBetween(from, to, " ");
  return {
    from,
    to,
    href: (mark?.attrs.href as string) || "",
    text,
  };
}

export const LinkToolbar = Extension.create({
  name: "linkToolbar",

  addCommands() {
    return {
      openLinkToolbar:
        () =>
        ({ state, dispatch }) => {
          if (dispatch) {
            const tr = state.tr.setMeta("openLinkToolbarExplicit", true);
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;

    let popoverEl: HTMLElement | null = null;
    let textField: HTMLInputElement | null = null;
    let urlField: HTMLInputElement | null = null;
    let activeRange: LinkRange | null = null;
    let isEditing = false;

    function createPopover() {
      if (popoverEl) return;
      popoverEl = document.createElement("div");
      popoverEl.className = "orbit-link-toolbar";
      popoverEl.style.display = "none";

      const fieldsWrapper = document.createElement("div");
      fieldsWrapper.className = "orbit-link-toolbar-fields";

      textField = document.createElement("input");
      textField.type = "text";
      textField.className = "orbit-link-toolbar-input";
      textField.placeholder = "显示文本";

      urlField = document.createElement("input");
      urlField.type = "url";
      urlField.className = "orbit-link-toolbar-input";
      urlField.placeholder = "https:// (留空清除链接)";

      fieldsWrapper.appendChild(textField);
      fieldsWrapper.appendChild(urlField);

      const submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.className = "orbit-link-toolbar-btn";
      submitBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

      submitBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        applyChanges();
      });

      textField.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyChanges();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          hidePopover();
          editor.commands.focus();
        }
      });

      urlField.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          applyChanges();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          hidePopover();
          editor.commands.focus();
        }
      });

      popoverEl.appendChild(fieldsWrapper);
      popoverEl.appendChild(submitBtn);
      document.body.appendChild(popoverEl);
    }

    function applyChanges() {
      if (!activeRange || !textField || !urlField) return;

      const newText = textField.value.trim();
      const rawUrl = urlField.value.trim();
      const linkType = editor.schema.marks.link;
      if (!linkType) return;

      const { from, to } = activeRange;

      if (!rawUrl) {
        // Unlink
        editor
          .chain()
          .focus()
          .setTextSelection({ from, to })
          .unsetLink()
          .run();
        hidePopover();
        return;
      }

      const href = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
      const textToInsert = newText || href;

      editor.chain().focus().run();
      const tr = editor.state.tr;
      tr.replaceWith(from, to, editor.schema.text(textToInsert));
      tr.addMark(from, from + textToInsert.length, linkType.create({ href }));
      editor.view.dispatch(tr);
      hidePopover();
    }

    function updatePosition() {
      if (!popoverEl || !activeRange) return;
      try {
        const coords = editor.view.coordsAtPos(activeRange.to);
        const popoverHeight = popoverEl.offsetHeight || 72;
        const viewportHeight = window.innerHeight;

        let top = coords.bottom + 6;
        if (top + popoverHeight > viewportHeight - 12) {
          top = Math.max(12, coords.top - popoverHeight - 6);
        }

        popoverEl.style.left = `${Math.max(12, Math.min(coords.left, window.innerWidth - 320))}px`;
        popoverEl.style.top = `${top}px`;
      } catch {
        hidePopover();
      }
    }

    function showPopover(range: LinkRange, autoFocus = false) {
      createPopover();
      if (!popoverEl || !textField || !urlField) return;

      activeRange = range;
      textField.value = range.text;
      urlField.value = range.href;

      popoverEl.style.display = "flex";
      updatePosition();

      if (autoFocus) {
        isEditing = true;
        if (range.href) {
          urlField.focus();
          urlField.select();
        } else {
          urlField.focus();
        }
      }
    }

    function hidePopover() {
      if (popoverEl) {
        popoverEl.style.display = "none";
      }
      activeRange = null;
      isEditing = false;
    }

    return [
      new Plugin({
        key: linkToolbarPluginKey,
        props: {
          handleDOMEvents: {
            blur(_view, event) {
              const related = event.relatedTarget as Node | null;
              if (popoverEl && related && popoverEl.contains(related)) {
                return false;
              }
              if (!isEditing) {
                setTimeout(() => hidePopover(), 150);
              }
              return false;
            },
          },
        },
        appendTransaction(transactions, _oldState, newState) {
          if (!editor.isEditable) {
            hidePopover();
            return null;
          }

          const explicit = transactions.some((tr) => tr.getMeta("openLinkToolbarExplicit"));
          const linkRange = getLinkRange(newState);

          if (explicit) {
            const { selection } = newState;
            const from = selection.from;
            const to = selection.to;
            const text = selection.empty ? "" : newState.doc.textBetween(from, to, " ");
            const range: LinkRange = linkRange || { from, to, href: "", text };
            showPopover(range, true);
            return null;
          }

          if (linkRange && !isEditing) {
            showPopover(linkRange, false);
          } else if (!linkRange && !isEditing) {
            hidePopover();
          }

          return null;
        },
        destroy() {
          if (popoverEl && popoverEl.parentNode) {
            popoverEl.parentNode.removeChild(popoverEl);
            popoverEl = null;
          }
        },
      }),
    ];
  },
});
