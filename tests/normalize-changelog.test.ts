import { it } from "node:test";
import assert from "node:assert/strict";
import { normalizeChangelog } from "../scripts/normalize-changelog.mjs";

it("preserves release content and general documentation while removing repository history links", () => {
  const text = [
    "[release-please](https://github.com/googleapis/release-please)",
    "## [1.2.0](https://github.com/example/private/compare/v1.1.0...v1.2.0) (2026-10-11)",
    "* **fix:** preserve user edits ([#123](https://github.com/example/private/issues/123)) ([abcdef0](https://github.com/example/private/commit/abcdef012345))",
    "* Follow [migration instructions](https://docs.example/migrate).",
    "",
  ].join("\n");
  const expected = [
    "[release-please](https://github.com/googleapis/release-please)",
    "## 1.2.0 (2026-10-11)",
    "* **fix:** preserve user edits",
    "* Follow [migration instructions](https://docs.example/migrate).",
    "",
  ].join("\n");
  assert.equal(normalizeChangelog(text), expected);
  assert.equal(normalizeChangelog(expected), expected);
  assert.equal(normalizeChangelog(text.replaceAll("example/private", "example/public")), expected);
});
