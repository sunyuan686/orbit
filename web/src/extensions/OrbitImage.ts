import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";

/**
 * TipTap Image with a loading frame so unread/remote images keep layout
 * space before pixels arrive (bare <img> collapses to ~0 height).
 */
export const OrbitImage = Image.extend({
  addNodeView() {
    return ({ node, HTMLAttributes }) => {
      const dom = document.createElement("div");
      dom.className = "orbit-image-frame";

      const img = document.createElement("img");
      const attrs = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        src: node.attrs.src,
        alt: node.attrs.alt ?? "",
        title: node.attrs.title,
      });
      for (const [key, value] of Object.entries(attrs)) {
        if (value == null || value === false) continue;
        if (key === "class") {
          img.className = String(value);
          continue;
        }
        img.setAttribute(key, String(value));
      }

      let src = node.attrs.src as string;

      const finish = (ok: boolean) => {
        dom.classList.add(ok ? "is-loaded" : "is-error");
      };

      const watch = () => {
        dom.classList.remove("is-loaded", "is-error");
        if (img.complete && img.naturalWidth > 0) {
          finish(true);
          return;
        }
        img.addEventListener("load", () => finish(true), { once: true });
        img.addEventListener("error", () => finish(false), { once: true });
      };

      watch();
      dom.appendChild(img);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "image") return false;
          const nextSrc = (updatedNode.attrs.src as string) ?? "";
          if (nextSrc !== src) {
            src = nextSrc;
            img.setAttribute("src", nextSrc);
            watch();
          }
          img.alt = updatedNode.attrs.alt ?? "";
          if (updatedNode.attrs.title) {
            img.title = updatedNode.attrs.title;
          } else {
            img.removeAttribute("title");
          }
          return true;
        },
      };
    };
  },
});
