/**
 * 线上 Cloudflare D1 数据库备份脚本
 *
 * 用法：npm run db:backup:remote
 */
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { exportRemoteD1Backup } from "./d1-backup-helper.js";

function getTimestampString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main() {
  const backupDir = join(process.cwd(), "data/backups");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = getTimestampString();
  const outputFile = join(backupDir, `d1_remote_${timestamp}.sql`);

  console.log("正在从 Cloudflare D1 远程导出实体表 SQL 备份...");
  console.log(`目标路径: ${outputFile}`);

  try {
    exportRemoteD1Backup(outputFile);
    console.log(`\n\x1b[32m✅ 线上 D1 数据库已成功导出备份：\x1b[0m\n   ${outputFile}\n`);
  } catch (err) {
    console.error(`\n\x1b[31m❌ 线上数据库导出失败！\x1b[0m`, err);
    process.exit(1);
  }
}

main();
