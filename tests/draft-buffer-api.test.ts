import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createArticlesRoutes } from "../src/api/articles.js";
import { db } from "../src/db/index.js";

const mockSession = {
  userId: "rvIAlujiOgWfrEsCHZS3MZkMmEs21OVD",
  author: "小圆子",
};

describe("Single Draft Buffer API (单草稿断点模型回归测试)", () => {
  const app = new Hono();
  app.route(
    "/api/articles",
    createArticlesRoutes(() => db, {
      getSessionAuthor: async () => mockSession,
    })
  );

  let draftId: string;

  it("POST /api/articles (status: draft) - 创建首个草稿", async () => {
    const res = await app.request("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "moment",
        title: "第一次保存草稿",
        body: "<p>第一版草稿内容</p>",
        status: "draft",
      }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { id: string };
    assert.ok(data.id);
    draftId = data.id;
  });

  it("GET /api/articles?status=draft - 仅返回最新的 1 篇草稿", async () => {
    const res = await app.request("/api/articles?status=draft&type=moment");
    assert.equal(res.status, 200);
    const list = (await res.json()) as Array<{ id: string; title: string; snippet: string }>;
    assert.equal(list.length, 1);
    assert.equal(list[0].id, draftId);
    assert.equal(list[0].title, "第一次保存草稿");
  });

  it("POST /api/articles (status: draft) - 同类型草稿原子就地覆盖更新 (同一ID)", async () => {
    const res = await app.request("/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "moment",
        title: "第二次修改并保存草稿",
        body: "<p>第二版覆盖后的内容</p>",
        status: "draft",
      }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { id: string };
    // 关键校验：ID 保持不变，实现原子覆盖，绝不产生第 2 篇冗余草稿
    assert.equal(data.id, draftId);
  });

  it("GET /api/articles?status=draft - 查验覆盖后的单篇草稿内容与长度", async () => {
    const res = await app.request("/api/articles?status=draft&type=moment");
    assert.equal(res.status, 200);
    const list = (await res.json()) as Array<{ id: string; title: string; snippet: string }>;
    assert.equal(list.length, 1);
    assert.equal(list[0].id, draftId);
    assert.equal(list[0].title, "第二次修改并保存草稿");
    assert.ok(list[0].snippet.includes("第二版覆盖"));
  });

  it("DELETE /api/articles/:id - 物理丢弃草稿并验证该草稿已删除", async () => {
    const delRes = await app.request(`/api/articles/${draftId}`, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 200);

    const checkRes = await app.request("/api/articles?status=draft&type=moment");
    assert.equal(checkRes.status, 200);
    const list = (await checkRes.json()) as Array<{ id: string }>;
    assert.ok(!list.some((d) => d.id === draftId), "已删除的草稿不应存在");
  });
});
