import { imageSchema } from "@milkdown/kit/preset/commonmark";
import { $view } from "@milkdown/kit/utils";
import type { NodeViewConstructor } from "@milkdown/kit/prose/view";

const COLLAPSED_HEIGHT = 80;

export const collapsibleImageView = $view(
  imageSchema.node,
  (): NodeViewConstructor => {
    return (node) => {
      // 外层容器
      const dom = document.createElement("span");
      dom.className = "orbit-image-wrapper";
      dom.style.display = "inline-block";
      dom.style.position = "relative";
      dom.style.width = "100%";
      dom.style.margin = "4px 0";

      // 图片容器（可折叠）
      const imgContainer = document.createElement("span");
      imgContainer.style.display = "block";
      imgContainer.style.overflow = "hidden";
      imgContainer.style.height = `${COLLAPSED_HEIGHT}px`;
      imgContainer.style.transition = "height 0.25s ease";
      imgContainer.style.borderRadius = "8px";

      // 图片
      const img = document.createElement("img");
      img.src = node.attrs.src || "";
      img.alt = node.attrs.alt || "";
      if (node.attrs.title) img.title = node.attrs.title;
      img.style.width = "100%";
      img.style.display = "block";
      img.style.borderRadius = "8px";
      imgContainer.appendChild(img);

      // 折叠遮罩（渐变）
      const overlay = document.createElement("span");
      overlay.style.cssText =
        "position:absolute;bottom:28px;left:0;right:0;height:40px;pointer-events:none;border-radius:0 0 8px 8px;";
      overlay.className = "orbit-image-overlay";

      // 切换按钮
      const btn = document.createElement("button");
      btn.className = "orbit-image-toggle";
      btn.style.cssText =
        "display:flex;align-items:center;justify-content:center;gap:4px;width:100%;padding:4px 0;font-size:12px;border:none;background:transparent;cursor:pointer;opacity:0.6;transition:opacity 0.15s;";
      btn.onmouseenter = () => { btn.style.opacity = "1"; };
      btn.onmouseleave = () => { btn.style.opacity = "0.6"; };

      const arrow = document.createElement("span");
      arrow.textContent = "▼";
      arrow.style.cssText = "font-size:10px;transition:transform 0.25s;display:inline-block;";

      const label = document.createElement("span");
      label.textContent = "展开图片";

      btn.appendChild(arrow);
      btn.appendChild(label);

      let expanded = false;

      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        expanded = !expanded;
        if (expanded) {
          imgContainer.style.height = "auto";
          overlay.style.display = "none";
          arrow.style.transform = "rotate(180deg)";
          label.textContent = "收起图片";
        } else {
          imgContainer.style.height = `${COLLAPSED_HEIGHT}px`;
          overlay.style.display = "";
          arrow.style.transform = "";
          label.textContent = "展开图片";
        }
      });

      // 如果图片本身就很小，不需要折叠
      img.addEventListener("load", () => {
        if (img.naturalHeight <= COLLAPSED_HEIGHT + 20) {
          imgContainer.style.height = "auto";
          overlay.style.display = "none";
          btn.style.display = "none";
          expanded = true;
        }
      });

      dom.appendChild(imgContainer);
      dom.appendChild(overlay);
      dom.appendChild(btn);

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== "image") return false;
          img.src = updatedNode.attrs.src || "";
          img.alt = updatedNode.attrs.alt || "";
          if (updatedNode.attrs.title) img.title = updatedNode.attrs.title;
          return true;
        },
        stopEvent: (e) => {
          return e.target === btn || btn.contains(e.target as Node);
        },
      };
    };
  }
);
