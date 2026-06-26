import type { FC } from "react";
import { Milkdown, MilkdownProvider, useEditor } from "@milkdown/react";
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from "@milkdown/kit/core";
import { commonmark } from "@milkdown/kit/preset/commonmark";
import { listener, listenerCtx } from "@milkdown/kit/plugin/listener";
import { history } from "@milkdown/kit/plugin/history";
import { uploadImage } from "../lib/api";
import { collapsibleImageView } from "../lib/imageViewPlugin";
import "@milkdown/theme-nord/style.css";

interface Props {
  defaultValue: string;
  onChange?: (markdown: string) => void;
  readonly?: boolean;
}

/** 将 Markdown 中的 assets/ 相对路径转为 /assets/ 绝对路径，供浏览器正确加载 */
function resolveAssetPaths(md: string): string {
  return md.replace(/!\[([^\]]*)\]\(assets\//g, "![$1](/assets/");
}

/** 将 /assets/ 绝对路径还原为 assets/ 相对路径，保持存储一致性 */
function unresolveAssetPaths(md: string): string {
  return md.replace(/!\[([^\]]*)\]\(\/assets\//g, "![$1](assets/");
}

const MilkdownInner: FC<Props> = ({ defaultValue, onChange, readonly }) => {
  useEditor(
    (root) => {
      const editor = Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root);
          ctx.set(defaultValueCtx, resolveAssetPaths(defaultValue));
          if (readonly) {
            ctx.update(editorViewOptionsCtx, (prev) => ({
              ...prev,
              editable: () => false,
            }));
          }
          if (onChange) {
            ctx
              .get(listenerCtx)
              .markdownUpdated((_ctx, markdown) => {
                onChange(unresolveAssetPaths(markdown));
              });
          }
        })
        .use(commonmark)
        .use(listener)
        .use(history)
        .use(collapsibleImageView);
      return editor;
    },
    [defaultValue]
  );

  return <Milkdown />;
};

export const MilkdownEditor: FC<Props> = (props) => {
  return (
    <MilkdownProvider>
      <div
        className={`milkdown-wrapper orbit-milkdown-shell${props.readonly ? " cursor-default" : ""}`}
        onPaste={
          props.readonly
            ? undefined
            : async (e) => {
                const items = e.clipboardData?.items;
                if (!items) return;
                for (const item of items) {
                  if (item.type.startsWith("image/")) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    if (!file) return;
                    const url = await uploadImage(file);
                    if (props.onChange) {
                      props.onChange(
                        (document.querySelector(".milkdown .editor")
                          ?.textContent || "") + `\n![](${url})\n`
                      );
                    }
                  }
                }
              }
        }
      >
        <MilkdownInner {...props} />
      </div>
    </MilkdownProvider>
  );
};
