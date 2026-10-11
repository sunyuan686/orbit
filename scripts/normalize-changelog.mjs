import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function normalizeChangelog(text) {
  return text
    .replace(
      /[ \t]*\(\[(?:[a-f0-9]{7,40}|#\d+)\]\(https:\/\/github\.com\/[^/\s)]+\/[^/\s)]+\/(?:commit|issues|pull)\/[^)\s]+\)\)/gi,
      "",
    )
    .replace(
      /\[([^\]\n]+)\]\(https:\/\/github\.com\/[^/\s)]+\/[^/\s)]+\/(?:compare|commit|issues|pull|releases\/tag)\/[^)\s]+\)/g,
      "$1",
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = process.argv[2] || "CHANGELOG.md";
  const before = readFileSync(file, "utf8");
  const after = normalizeChangelog(before);
  if (after !== before) writeFileSync(file, after);
}
