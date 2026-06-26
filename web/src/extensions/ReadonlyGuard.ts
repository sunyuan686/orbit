import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

/** Meta key for programmatic doc changes allowed in readonly mode (e.g. comment highlights). */
export const ORBIT_ALLOW_DOC_CHANGE = "orbitAllowDocChange";

/**
 * Blocks user-driven document mutations while readonly, but allows selection
 * updates and transactions explicitly marked with {@link ORBIT_ALLOW_DOC_CHANGE}.
 *
 * Used with `editable: false` on the read view so input is blocked at the DOM
 * level instead of relying on per-key event interception.
 */
export const ReadonlyGuard = Extension.create({
  name: "readonlyGuard",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("readonlyGuard"),
        filterTransaction: (transaction) => {
          if (this.editor.isEditable) {
            return true;
          }
          if (transaction.getMeta(ORBIT_ALLOW_DOC_CHANGE)) {
            return true;
          }
          return !transaction.docChanged;
        },
      }),
    ];
  },
});
