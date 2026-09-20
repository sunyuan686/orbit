import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, statSync } from "fs";
import { join } from "path";
import type Database from "better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createLogger } from "../lib/logger.js";

const log = createLogger("db:migrate");

export interface SafeMigrateOptions {
  migrationsFolder?: string;
  backupDir?: string;
  maxBackups?: number;
}

function getTimestampString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(
    now.getHours()
  )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * 探测是否有待执行的 Drizzle 迁移项
 */
export function getPendingMigrationTag(
  sqlite: Database.Database,
  migrationsFolder: string
): string | null {
  const journalPath = join(migrationsFolder, "meta/_journal.json");
  if (!existsSync(journalPath)) return null;

  const tableExists = sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='__drizzle_migrations'"
    )
    .get();

  let journal: { entries: Array<{ tag: string; idx: number }> };
  try {
    journal = JSON.parse(readFileSync(journalPath, "utf-8"));
  } catch {
    return null;
  }

  if (!journal.entries || journal.entries.length === 0) return null;

  if (!tableExists) {
    return journal.entries[0]?.tag ?? "initial";
  }

  const appliedRow = sqlite
    .prepare("SELECT count(*) as count FROM __drizzle_migrations")
    .get() as { count: number } | undefined;
  const appliedCount = appliedRow?.count ?? 0;

  if (journal.entries.length > appliedCount) {
    return journal.entries[appliedCount]?.tag ?? "next";
  }

  return null;
}

/**
 * 清理超出数量限制的旧物理备份文件，保留最新的 maxKeep 份
 */
function pruneOldBackups(backupDir: string, pattern: RegExp, maxKeep: number) {
  try {
    if (!existsSync(backupDir)) return;
    const files = readdirSync(backupDir)
      .filter((file) => pattern.test(file))
      .map((file) => {
        const fullPath = join(backupDir, file);
        return {
          path: fullPath,
          mtime: statSync(fullPath).mtimeMs,
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length > maxKeep) {
      for (const excess of files.slice(maxKeep)) {
        try {
          unlinkSync(excess.path);
        } catch {
          // 忽略单文件删除失败
        }
      }
    }
  } catch (err) {
    log.warn("清理旧备份文件时出错", { error: String(err) });
  }
}

/**
 * 手动或自动创建当前 SQLite 数据库的物理快照
 */
export async function createLocalBackup(
  sqlite: Database.Database,
  backupDir = join(process.cwd(), "data/backups"),
  label = "manual"
): Promise<string> {
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  // 1. 先刷写 WAL 缓存，确保物理文件完整一致
  try {
    sqlite.pragma("wal_checkpoint(TRUNCATE)");
  } catch (err) {
    log.warn("WAL checkpoint warning before backup", { error: String(err) });
  }

  // 2. 利用 better-sqlite3 在线热备份 API 创建完整无损副本
  const timestamp = getTimestampString();
  const backupFileName = `orbit_${label}_${timestamp}.db`;
  const backupPath = join(backupDir, backupFileName);

  await sqlite.backup(backupPath);
  return backupPath;
}

/**
 * 具有前置备份保障的安全迁移函数
 */
export async function safeMigrate(
  sqlite: Database.Database,
  db: any,
  options: SafeMigrateOptions = {}
): Promise<boolean> {
  const migrationsFolder =
    options.migrationsFolder ?? join(process.cwd(), "src/db/migrations");
  const backupDir =
    options.backupDir ?? join(process.cwd(), "data/backups");
  const maxBackups = options.maxBackups ?? 10;

  const pendingTag = getPendingMigrationTag(sqlite, migrationsFolder);

  if (pendingTag) {
    log.info(`检测到待应用迁移 [${pendingTag}]，开始自动前置备份...`);
    try {
      const backupPath = await createLocalBackup(
        sqlite,
        backupDir,
        `pre_${pendingTag}`
      );
      pruneOldBackups(backupDir, /^orbit_pre_.*\.db$/, maxBackups);
      console.log(
        `\x1b[32m[safe-migrate] 🛡️ 迁移前已自动安全备份至: ${backupPath}\x1b[0m`
      );
    } catch (err) {
      console.error(
        `\x1b[31m[safe-migrate] ❌ 迁移前自动备份失败，已终止迁移以保护原数据！\x1b[0m`,
        err
      );
      throw new Error(
        `迁移前备份失败，操作已中止: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  sqlite.pragma("foreign_keys = OFF");
  try {
    migrate(db, { migrationsFolder });
    return Boolean(pendingTag);
  } finally {
    sqlite.pragma("foreign_keys = ON");
  }
}
