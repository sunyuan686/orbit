import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAlbumsRoutes } from "../src/api/albums.js";
import { createTestDb } from "./helpers/test-db.js";

const { db, sqlite } = createTestDb();
after(() => sqlite.close());

const mockSession = {
  userId: "test-user",
  author: "Test User",
};

describe("Albums API & System Photo Stream (方案B首卡系统相册回归测试)", () => {
  const app = new Hono();
  app.route(
    "/api/albums",
    createAlbumsRoutes(() => db, {
      getSessionAuthor: async () => mockSession,
    })
  );

  let createdAlbumId: string;

  it("GET /api/albums - 首卡必须为系统相册《全部照片》", async () => {
    const res = await app.request("/api/albums");
    assert.equal(res.status, 200);
    const data = (await res.json()) as Array<{
      id: string;
      title: string;
      photoCount: number;
      isDefault: boolean;
      sortOrder: number;
    }>;

    assert.ok(Array.isArray(data), "返回相册数组");
    assert.ok(data.length >= 1, "至少包含一个系统相册");

    const systemAlbum = data[0];
    assert.equal(systemAlbum.id, "all", "首卡 id 为 all");
    assert.equal(systemAlbum.title, "全部照片", "首卡标题为全部照片");
    assert.equal(systemAlbum.isDefault, true, "isDefault 标记为 true");
    assert.ok(systemAlbum.photoCount >= 0, "photoCount 为非负数");
  });

  it("GET /api/albums/all - 获取系统全量相册详情及相片流", async () => {
    const res = await app.request("/api/albums/all");
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      id: string;
      title: string;
      isDefault: boolean;
      photoCount: number;
      photos: Array<{ id: string; assetId: string; url: string; thumbUrl: string }>;
    };

    assert.equal(data.id, "all");
    assert.equal(data.title, "全部照片");
    assert.equal(data.isDefault, true);
    assert.ok(Array.isArray(data.photos), "包含照片流数组");
    assert.equal(data.photos.length, data.photoCount, "照片数组长度与统计一致");
  });

  it("PUT & DELETE /api/albums/all - 保护拦截系统相册不可修改或删除", async () => {
    // 尝试修改系统相册
    const putRes = await app.request("/api/albums/all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "篡改标题" }),
    });
    assert.equal(putRes.status, 400);
    const putData = (await putRes.json()) as { error?: string };
    assert.equal(putData.error, "系统相册不可修改");

    // 尝试删除系统相册
    const delRes = await app.request("/api/albums/all", {
      method: "DELETE",
    });
    assert.equal(delRes.status, 400);
    const delData = (await delRes.json()) as { error?: string };
    assert.equal(delData.error, "系统相册不可删除");
  });

  it("POST /api/albums - 创建自建主题画册", async () => {
    const res = await app.request("/api/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "美味蛋糕合集",
        description: "每次纪念日吃过的好吃蛋糕",
      }),
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { id: string };
    assert.ok(data.id.startsWith("alb_"));
    createdAlbumId = data.id;
  });

  it("GET /api/albums/:id - 查验新建的主题画册", async () => {
    const res = await app.request(`/api/albums/${createdAlbumId}`);
    assert.equal(res.status, 200);
    const data = (await res.json()) as {
      id: string;
      title: string;
      description: string;
      isDefault: boolean;
      photos: unknown[];
    };
    assert.equal(data.title, "美味蛋糕合集");
    assert.equal(data.description, "每次纪念日吃过的好吃蛋糕");
    assert.equal(data.isDefault, false);
    assert.equal(data.photos.length, 0);
  });

  it("DELETE /api/albums/:id - 删除测试主题画册", async () => {
    const res = await app.request(`/api/albums/${createdAlbumId}`, {
      method: "DELETE",
    });
    assert.equal(res.status, 200);
    const data = (await res.json()) as { ok: boolean };
    assert.equal(data.ok, true);

    // 验证删除后 404
    const checkRes = await app.request(`/api/albums/${createdAlbumId}`);
    assert.equal(checkRes.status, 404);
  });
});
