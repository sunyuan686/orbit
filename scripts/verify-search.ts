/**
 * 搜索功能验证脚本
 * 用法：npx tsx scripts/verify-search.ts
 */

import { join } from "path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../src/db/index.js";
import { createSearchService, getSearchIndexStatus } from "../src/services/search.js";

migrate(db, { migrationsFolder: join(process.cwd(), "src/db/migrations") });

const search = createSearchService(db);
const status = await getSearchIndexStatus(db);

const cases = [
  { q: "爱", desc: "单字（LIKE 回退）", minResults: 1 },
  { q: "恋爱", desc: "双字（LIKE 回退）", minResults: 1 },
  { q: "太原", desc: "地名（FTS ≥3 字）", minResults: 1 },
  { q: "恋爱原则", desc: "备忘录标题", minResults: 1, expectType: "memo" },
  { q: "xyz_no_match_abc", desc: "无结果", minResults: 0, maxResults: 0 },
  { q: "  ", desc: "空查询", minResults: 0, maxResults: 0 },
];

let passed = 0;
let failed = 0;

console.log("\n── 1. 索引状态 ──");
if (!status.indexingComplete) {
  console.log("❌ 索引未就绪");
  process.exit(1);
}
console.log("✅ 索引就绪，entry/memo 条数一致\n");

console.log("── 2. 搜索服务用例 ──\n");

for (const tc of cases) {
  const results = await search.search(tc.q);
  const okCount =
    results.length >= tc.minResults &&
    (tc.maxResults === undefined || results.length <= tc.maxResults);
  const okType =
    !tc.expectType || results.some((r) => r.type === tc.expectType);
  const okSnippet =
    tc.minResults === 0 ||
    tc.expectType === "memo" ||
    results.some((r) => r.snippet && (r.snippet.includes("<mark>") || r.title));

  const ok = okCount && okType && (tc.minResults === 0 || okSnippet);

  if (ok) {
    passed++;
    console.log(`✅ [${tc.desc}] q="${tc.q.trim() || "(空)"}" → ${results.length} 条`);
    if (results[0]) {
      console.log(`   首条: ${results[0].type} / ${results[0].title ?? "(无标题)"}`);
    }
  } else {
    failed++;
    console.log(`❌ [${tc.desc}] q="${tc.q}" → ${results.length} 条`);
    console.log("   ", { okCount, okType, okSnippet, sample: results[0] });
  }
}

console.log("\n── 3. 写入后即时索引 ──\n");

const testId = `ent_search_test_${Date.now().toString(36)}`;
const uniqueToken = `orbit_verify_${Date.now()}`;
const now = Math.floor(Date.now() / 1000);

await db.run(
  // drizzle run for raw insert - use sql
  (await import("drizzle-orm")).sql`
    INSERT INTO entry (id, type, author, title, body, body_text, entry_date, created_at, updated_at)
    VALUES (${testId}, 'diary', '小圆子', '搜索验证', ${`测试正文 ${uniqueToken}`}, ${`测试正文 ${uniqueToken}`}, ${now}, ${now}, ${now})
  `
);

const afterInsert = await search.search(uniqueToken);
const insertOk = afterInsert.some((r) => r.id === testId);

if (insertOk) {
  passed++;
  console.log(`✅ 新建 entry 后立刻可搜到 (${uniqueToken})`);
} else {
  failed++;
  console.log(`❌ 新建 entry 后搜不到 (${uniqueToken})`);
}

await db.run(
  (await import("drizzle-orm")).sql`DELETE FROM entry WHERE id = ${testId}`
);

const afterDelete = await search.search(uniqueToken);
const deleteOk = !afterDelete.some((r) => r.id === testId);

if (deleteOk) {
  passed++;
  console.log("✅ 删除 entry 后索引同步移除");
} else {
  failed++;
  console.log("❌ 删除 entry 后仍能搜到");
}

console.log(`\n── 结果: ${passed} 通过, ${failed} 失败 ──\n`);
process.exit(failed > 0 ? 1 : 0);
