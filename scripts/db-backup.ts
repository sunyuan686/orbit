/**
 * 本地数据库即时快照备份脚本
 *
 * 用法：npm run db:backup
 */
import { sqlite } from "../src/db/index.js";
import { createLocalBackup } from "../src/db/safe-migrate.js";

async function main() {
  console.log("正在创建本地数据库快照备份...");
  try {
    const backupPath = await createLocalBackup(sqlite, undefined, "manual");
    console.log(`\x1b[32m✅ 本地数据库快照已成功创建：\x1b[0m\n   ${backupPath}\n`);
  } catch (err) {
    console.error(`\x1b[31m❌ 备份失败：\x1b[0m`, err);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

main();
