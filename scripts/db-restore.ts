/**
 * 本地数据库回滚/恢复脚本
 *
 * 用法：
 *   npm run db:restore                         # 查看所有可用备份
 *   npm run db:restore <backup_file_path>      # 恢复指定备份
 */
import { existsSync, readdirSync, statSync, copyFileSync, unlinkSync } from "fs";
import { join, resolve } from "path";

function listBackups(backupDir: string) {
  if (!existsSync(backupDir)) {
    console.log("未找到备份目录: data/backups");
    return;
  }
  const files = readdirSync(backupDir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => {
      const full = join(backupDir, f);
      const stat = statSync(full);
      return {
        name: f,
        path: full,
        size: (stat.size / 1024 / 1024).toFixed(2) + " MB",
        mtime: new Date(stat.mtimeMs).toLocaleString("zh-CN"),
      };
    })
    .sort((a, b) => b.name.localeCompare(a.name));

  if (files.length === 0) {
    console.log("data/backups 目录下暂无可恢复的 .db 备份文件。");
    return;
  }

  console.log("\n── 可用备份文件列表 ──\n");
  files.forEach((f, idx) => {
    console.log(`[${idx + 1}] ${f.name} (${f.size}, ${f.mtime})`);
  });
  console.log("\n如需恢复，请运行：npm run db:restore data/backups/<文件名>\n");
}

function restoreBackup(targetFile: string) {
  const fullPath = resolve(process.cwd(), targetFile);
  if (!existsSync(fullPath)) {
    console.error(`\x1b[31m❌ 备份文件不存在：${fullPath}\x1b[0m`);
    process.exit(1);
  }

  const dbPath = resolve(process.cwd(), "data/orbit.db");
  const walPath = resolve(process.cwd(), "data/orbit.db-wal");
  const shmPath = resolve(process.cwd(), "data/orbit.db-shm");

  // 1. 恢复前先给当前状态打一次安全底（防止误恢复后无法撤销）
  if (existsSync(dbPath)) {
    const safetyTag = `orbit_safety_before_restore_${Date.now()}.db`;
    const safetyPath = join(process.cwd(), "data/backups", safetyTag);
    copyFileSync(dbPath, safetyPath);
    console.log(`🛡️  已自动对恢复前的当前状态做防险备份：${safetyPath}`);
  }

  // 2. 清理旧 WAL / SHM，防止脏页污染恢复后的数据库
  if (existsSync(walPath)) unlinkSync(walPath);
  if (existsSync(shmPath)) unlinkSync(shmPath);

  // 3. 覆盖恢复
  copyFileSync(fullPath, dbPath);
  console.log(`\x1b[32m✅ 数据库已成功还原至备份状态：\x1b[0m\n   源文件: ${fullPath}\n   目标库: ${dbPath}\n`);
}

const target = process.argv[2];
if (!target) {
  listBackups(join(process.cwd(), "data/backups"));
} else {
  restoreBackup(target);
}
