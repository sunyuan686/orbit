/**
 * 刷新数据库内全部 active entry 的 body_text 并重建 FTS 索引
 *
 * 用法：npx tsx scripts/backfill-body-text.ts
 */

import { join } from "path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { isNull, eq, sql } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { entry } from "../src/db/schema.js";
import { toPlainText } from "../src/lib/plain-text.js";

migrate(db, { migrationsFolder: join(process.cwd(), "src/db/migrations") });

async function main() {
  console.log("🔍 扫描需要刷新 body_text 的 entry 条目...");

  const allEntries = await db
    .select({
      id: entry.id,
      body: entry.body,
      bodyText: entry.bodyText,
      deletedAt: entry.deletedAt,
    })
    .from(entry)
    .where(isNull(entry.deletedAt));

  console.log(`📋 找到 ${allEntries.length} 条活跃条目。`);

  let updatedCount = 0;

  for (const item of allEntries) {
    const rawBody = item.body ?? "";
    const cleanBodyText = rawBody ? toPlainText(rawBody) : "";

    if (cleanBodyText !== (item.bodyText ?? "")) {
      await db
        .update(entry)
        .set({
          bodyText: cleanBodyText,
        })
        .where(eq(entry.id, item.id));
      updatedCount++;
    }
  }

  console.log(`✅ 已更新 ${updatedCount} 条记录的 body_text。`);

  try {
    db.run(sql`INSERT INTO entry_fts(entry_fts) VALUES ('rebuild');`);
    console.log("✅ 已成功重建 entry_fts 索引。");
  } catch (err) {
    console.warn("⚠️ 重建 entry_fts 索引提示:", err);
  }
}

main().catch((err) => {
  console.error("❌ 刷新失败:", err);
  process.exit(1);
});
