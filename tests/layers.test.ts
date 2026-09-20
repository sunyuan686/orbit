import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  historyIndex,
  readLayers,
  replaceTopLayer,
  sameUrl,
  topLayer,
  withLayer,
  withoutLayer,
} from "../web/src/lib/layers.js";

describe("Navigation Layer Stack (第一性原理回归测试)", () => {
  it("条目携带完整层栈快照，嵌套时父层仍在栈上（否则父浮层会被卸载）", () => {
    const page: null = null;
    const compose = withLayer(page, "compose");
    const tags = withLayer(compose, "tags");

    assert.deepEqual(readLayers(compose), [{ key: "compose" }]);
    assert.deepEqual(readLayers(tags), [{ key: "compose" }, { key: "tags" }]);
    assert.deepEqual(readLayers(page), []);
  });

  it("回退一格即回到父层条目：子层从栈上消失，父层保留", () => {
    const compose = withLayer(null, "compose");
    const tags = withLayer(compose, "tags");

    assert.equal(topLayer(tags)?.key, "tags");
    assert.equal(topLayer(compose)?.key, "compose");
    assert.equal(topLayer(null), undefined);
  });

  it("重复压入同一层是幂等的，不会堆出需要连按多次返回的条目", () => {
    const once = withLayer(null, "search");
    assert.deepEqual(withLayer(once, "search"), { layers: [{ key: "search" }] });
  });

  it("叠加新层时保留既有非层状态（如登录来源 from）", () => {
    const state = withLayer({ from: "/diary/abc" }, "search");
    assert.deepEqual(state, {
      from: "/diary/abc",
      layers: [{ key: "search" }],
    });
  });

  it("栈顶替换：横向换层不改变层级深度，下一层浮层保持不动", () => {
    const fullscreen = withLayer(null, "fullscreen");
    const swapped = replaceTopLayer(fullscreen, "draft-prompt");
    assert.deepEqual(readLayers(swapped), [{ key: "draft-prompt" }]);

    const nested = withLayer(withLayer(null, "compose"), "fullscreen");
    assert.deepEqual(readLayers(replaceTopLayer(nested, "draft-prompt")), [
      { key: "compose" },
      { key: "draft-prompt" },
    ]);
  });

  it("空栈上做替换等同于压入一层", () => {
    assert.deepEqual(replaceTopLayer(null, "search"), {
      layers: [{ key: "search" }],
    });
  });

  it("呈现层开关不改动地址：压入同 URL 条目", () => {
    assert.equal(
      sameUrl({ pathname: "/albums/abc", search: "?tab=1" }),
      "/albums/abc?tab=1",
    );
    assert.equal(sameUrl({ pathname: "/", search: "" }), "/");
  });

  it("导航状态引导剥离瞬时层，不残留 layers 字段", () => {
    const stripped = withoutLayer({
      from: "/us",
      layers: [{ key: "compose" }, { key: "tags" }],
    });
    assert.deepEqual(stripped, { from: "/us" });
    assert.deepEqual(readLayers(stripped), []);
  });

  it("非对象 / 结构非法的状态一律视为无层，不抛错", () => {
    assert.deepEqual(readLayers(undefined), []);
    assert.deepEqual(readLayers(null), []);
    assert.deepEqual(readLayers("search"), []);
    assert.deepEqual(readLayers({ layers: "search" }), []);
    assert.deepEqual(readLayers({ layers: { key: "search" } }), []);
    assert.deepEqual(readLayers({ layers: [{ key: "" }, null, { key: 1 }] }), []);
    assert.deepEqual(readLayers({ layers: [{ key: "ok" }, null] }), [{ key: "ok" }]);
  });

  it("根锚点判断只认「App 内第一条条目」，非法记账一律保守视为 0", () => {
    // 冷启动直达深链：react-router 写的 idx 为 0，栈里没有可返回的上一层
    assert.equal(historyIndex({ idx: 0, key: "a", usr: null }), 0);
    // App 内导航过（含刷新）：历史条目由本 App 创建，返回安全
    assert.equal(historyIndex({ idx: 3, key: "b", usr: null }), 3);
    // 非记账状态与非数值一律落到 0（宁可多补一次根锚点，也不漏补）
    assert.equal(historyIndex(null), 0);
    assert.equal(historyIndex(undefined), 0);
    assert.equal(historyIndex({}), 0);
    assert.equal(historyIndex({ idx: "2" }), 0);
    assert.equal(historyIndex({ idx: Number.NaN }), 0);
  });

  it("剥离不修改原状态对象（避免污染 router 持有的 history.state）", () => {
    const original = { layers: [{ key: "search" }] };
    withoutLayer(original);
    assert.deepEqual(original, { layers: [{ key: "search" }] });
  });
});
