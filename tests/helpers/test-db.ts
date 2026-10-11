import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { fileURLToPath } from "node:url";
import * as schema from "../../src/db/schema.js";

export function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  const migrations = readMigrationFiles({
    migrationsFolder: fileURLToPath(new URL("../../src/db/migrations", import.meta.url)),
  });
  for (const migration of migrations) {
    // Historical migration chunks can contain multiple SQL statements.
    for (const sql of migration.sql) sqlite.exec(sql);
  }
  db.insert(schema.user).values({
    id: "test-user",
    name: "Test User",
    email: "test-user@example.com",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  }).run();
  return { db, sqlite };
}
