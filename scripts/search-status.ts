/**
 * 查看 FTS 搜索索引状态
 *
 * 用法：npm run db:search-status
 */

import { join } from "path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../src/db/index.js";
import { getSearchIndexStatus } from "../src/services/search.js";

migrate(db, { migrationsFolder: join(process.cwd(), "src/db/migrations") });

const status = await getSearchIndexStatus(db);

console.log("\n── Orbit 搜索索引状态 ──\n");

if (!status.ftsReady) {
  console.log("❌ FTS 表未就绪");
  console.log("   请重启 server（会自动跑迁移），或确认 0002_fts_setup 已执行。\n");
  process.exit(1);
}

console.log(`索引就绪：${status.indexingComplete ? "✅ 是" : "⚠️  否"}`);
console.log(`条数一致：${status.inSync ? "✅ 是" : "⚠️  否"}`);
console.log("");
console.log(`entry  活跃 ${status.entry.active} 条 │ FTS 索引 ${status.entry.indexed} 条`);
console.log(`memo   活跃 ${status.memo.active} 条 │ FTS 索引 ${status.memo.indexed} 条`);

if (status.entry.missingBodyText > 0) {
  console.log("");
  console.log(
    `⚠️  ${status.entry.missingBodyText} 条 entry 有正文但缺少 body_text（搜索质量可能下降）`
  );
  console.log("   可重新保存这些条目，或运行 db:import 重建 body_text。");
}

console.log("");
console.log("说明：Orbit 使用 SQLite 触发器同步维护 FTS，没有后台建索引任务。");
console.log("迁移里的 rebuild 和服务启动时的 migrate 都是同步完成的。\n");

if (!status.indexingComplete) {
  console.log("修复建议：");
  console.log("  sqlite3 data/orbit.db \"INSERT INTO entry_fts(entry_fts) VALUES ('rebuild');\"");
  console.log("  sqlite3 data/orbit.db \"INSERT INTO memo_fts(memo_fts) VALUES ('rebuild');\"\n");
  process.exit(1);
}
