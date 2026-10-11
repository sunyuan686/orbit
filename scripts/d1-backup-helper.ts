/**
 * Cloudflare D1 远程备份辅助工具
 *
 * 解决 D1 官方 export 命令遇到 FTS5 等 Virtual Tables 时报错的问题：
 * 自动查询所有普通实体数据表，排除虚拟索引表及内部影子表后，安全导出所有业务真实数据。
 */
import { execFileSync } from "child_process";
import { prepareDeployConfig } from "./deploy-config.js";

export function getExportableTables(databaseName = "orbit-db", config = prepareDeployConfig()): string[] {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", databaseName, "--remote", "--json", "--config", config,
      "--command", "SELECT name, sql FROM sqlite_master WHERE type='table';"]
  ).toString();

  const jsonStart = output.indexOf("[");
  const jsonEnd = output.lastIndexOf("]");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error(`无法解析 D1 返回的表结构 JSON:\n${output}`);
  }

  const data = JSON.parse(output.substring(jsonStart, jsonEnd + 1));
  const rows: Array<{ name: string; sql: string | null }> = data[0]?.results ?? [];

  // 识别虚拟表（例如 entry_fts）
  const virtualTables = rows
    .filter((r) => r.sql && /CREATE\s+VIRTUAL\s+TABLE/i.test(r.sql))
    .map((r) => r.name);

  // 过滤出所有常规物理数据表（排除 sqlite_ 系统表、_cf_ 内部表、虚拟表及其影子表）
  return rows
    .map((r) => r.name)
    .filter((name) => {
      if (name.startsWith("sqlite_") || name.startsWith("_cf_")) return false;
      if (virtualTables.includes(name)) return false;
      if (virtualTables.some((vt) => name.startsWith(`${vt}_`))) return false;
      return true;
    });
}

export function exportRemoteD1Backup(
  outputFile: string,
  databaseName = "orbit-db",
  config = prepareDeployConfig(),
): void {
  const tables = getExportableTables(databaseName, config);
  if (tables.length === 0) {
    throw new Error("未检测到可导出的实体数据表");
  }

  const tableArgs = tables.flatMap((table) => ["--table", table]);
  execFileSync(
    "npx",
    ["wrangler", "d1", "export", databaseName, "--remote", "--config", config,
      "--output", outputFile, ...tableArgs, "-y"],
    { stdio: "inherit" }
  );
}
