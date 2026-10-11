/**
 * 线上 Cloudflare D1 安全迁移发布脚本（强制前置备份）
 *
 * 用法：npm run db:migrate:remote
 */
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { exportRemoteD1Backup } from "./d1-backup-helper.js";
import { prepareDeployConfig } from "./deploy-config.js";

function getTimestampString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function main() {
  const config = prepareDeployConfig();
  console.log("── 开始执行线上 Cloudflare D1 安全迁移流程 ──\n");

  // Step 1: 强制前置备份
  const backupDir = join(process.cwd(), "data/backups");
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = getTimestampString();
  const outputFile = join(backupDir, `d1_pre_deploy_${timestamp}.sql`);

  console.log("Step 1/2: 正在执行强制前置备份 (导出全部实体表数据)...");
  try {
    exportRemoteD1Backup(outputFile, "orbit-db", config);
    console.log(`\x1b[32m✅ 线上前置备份成功，已落盘至: ${outputFile}\x1b[0m\n`);
  } catch (err) {
    console.error(
      `\x1b[31m❌ 线上数据库前置备份失败！为保护生产数据安全，已立即中止迁移！\x1b[0m`,
      err
    );
    process.exit(1);
  }

  // Step 2: 正式应用迁移
  console.log("Step 2/2: 正在应用远程 D1 数据库迁移 (wrangler d1 migrations apply)...");
  try {
    execFileSync(
      "npx",
      ["wrangler", "d1", "migrations", "apply", "orbit-db", "--remote", "--config", config],
      { stdio: "inherit" }
    );
    console.log(`\n\x1b[32m🎉 线上 D1 数据库迁移全部顺利完成！\x1b[0m\n`);
  } catch (err) {
    console.error(`\n\x1b[31m❌ 线上迁移执行过程中发生错误，请使用备份文件进行排查与回滚：\x1b[0m\n   ${outputFile}\n`, err);
    process.exit(1);
  }
}

main();
