import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  saveScrollPosition,
  getSavedScrollPosition,
  clearScrollPositions,
} from "../web/src/lib/scrollPositions.js";

describe("Scroll Restoration Store (第一性原理滚动恢复映射测试)", () => {
  beforeEach(() => {
    clearScrollPositions();
  });

  it("未访问过的历史条目返回 undefined", () => {
    assert.equal(getSavedScrollPosition("unknown-key"), undefined);
  });

  it("记录与提取历史条目的滚动偏置", () => {
    saveScrollPosition("home-key", 850);
    assert.equal(getSavedScrollPosition("home-key"), 850);
  });

  it("多次滚动就地更新最新位置", () => {
    saveScrollPosition("home-key", 200);
    saveScrollPosition("home-key", 500);
    saveScrollPosition("home-key", 1200);
    assert.equal(getSavedScrollPosition("home-key"), 1200);
  });

  it("iOS 橡皮筋回弹导致的负数偏置被安全钳位为 0", () => {
    saveScrollPosition("home-key", -45);
    assert.equal(getSavedScrollPosition("home-key"), 0);
  });

  it("多条历史记录各自维持独立的滚动偏置", () => {
    saveScrollPosition("home", 600);
    saveScrollPosition("article-1", 150);
    saveScrollPosition("albums", 0);

    assert.equal(getSavedScrollPosition("home"), 600);
    assert.equal(getSavedScrollPosition("article-1"), 150);
    assert.equal(getSavedScrollPosition("albums"), 0);
  });

  it("清理操作可清空全部记录", () => {
    saveScrollPosition("home", 600);
    clearScrollPositions();
    assert.equal(getSavedScrollPosition("home"), undefined);
  });
});
