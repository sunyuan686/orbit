import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createTagsRoutes } from "../src/api/tags.js";
import { db } from "../src/db/index.js";

const mockSession = {
  userId: "rvIAlujiOgWfrEsCHZS3MZkMmEs21OVD",
  author: "小圆子",
};

describe("Tags API Routes (独立实体与单一数据源回归测试)", () => {
  const app = new Hono();
  app.route(
    "/api/tags",
    createTagsRoutes(() => db, {
      getSessionAuthor: async () => mockSession,
    })
  );

  let createdTagId: string;

  it("GET /api/tags - 获取标签列表及聚合计数", async () => {
    const res = await app.request("/api/tags");
    assert.equal(res.status, 200);
    const data = (await res.json()) as Array<{
      id: string;
      name: string;
      color: string;
      sortOrder: number;
      count: number;
    }>;
    assert.ok(Array.isArray(data));
    assert.ok(data.length >= 3);

    // 检查初始种子数据
    const milestone = data.find((t) => t.id === "milestone");
    const appreciation = data.find((t) => t.id === "appreciation");
    const message = data.find((t) => t.id === "message");

    assert.ok(milestone, "包含足迹标签");
    assert.equal(milestone?.name, "足迹");
    assert.ok(appreciation, "包含感谢标签");
    assert.equal(appreciation?.name, "感谢");
    assert.ok(message, "包含留言标签");
    assert.equal(message?.name, "留言");
    assert.equal(typeof message?.count, "number");
  });

  it("POST /api/tags - 创建新标签并校验参数", async () => {
    // 空名称校验
    const failRes = await app.request("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    assert.equal(failRes.status, 400);

    // 正常创建
    const testTag = {
      name: "周末漫游",
      color: "emerald",
    };
    const res = await app.request("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testTag),
    });
    assert.equal(res.status, 201);
    const created = (await res.json()) as {
      id: string;
      name: string;
      color: string;
      sortOrder: number;
      count: number;
    };
    assert.ok(created.id);
    assert.equal(created.name, "周末漫游");
    assert.equal(created.color, "emerald");
    assert.equal(created.count, 0);
    createdTagId = created.id;
  });

  it("PUT /api/tags/:id - 修改标签名称和颜色", async () => {
    assert.ok(createdTagId, "存在已创建的测试标签");
    const res = await app.request(`/api/tags/${createdTagId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "城市漫游",
        color: "indigo",
      }),
    });
    assert.equal(res.status, 200);
    const updated = (await res.json()) as {
      id: string;
      name: string;
      color: string;
    };
    assert.equal(updated.name, "城市漫游");
    assert.equal(updated.color, "indigo");
  });

  it("DELETE /api/tags/:id - 删除测试标签", async () => {
    assert.ok(createdTagId, "存在已创建的测试标签");
    const res = await app.request(`/api/tags/${createdTagId}`, {
      method: "DELETE",
    });
    assert.equal(res.status, 200);
    const result = (await res.json()) as { success: boolean };
    assert.equal(result.success, true);

    // 再次 GET 确认已被移除
    const listRes = await app.request("/api/tags");
    const data = (await listRes.json()) as Array<{ id: string }>;
    assert.ok(!data.some((t) => t.id === createdTagId));
  });
});
