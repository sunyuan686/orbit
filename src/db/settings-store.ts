import { eq } from "drizzle-orm";
import { settings } from "./schema.js";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export async function readSettingsMap(db: any): Promise<Record<string, string>> {
  const rows = (await db.select().from(settings)) as Array<{
    key: string;
    value: string;
  }>;
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

export async function upsertSetting(
  db: any,
  key: string,
  value: string
): Promise<void> {
  const timestamp = now();
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .get();

  if (existing) {
    await db
      .update(settings)
      .set({ value, updatedAt: timestamp })
      .where(eq(settings.key, key));
    return;
  }

  await db.insert(settings).values({ key, value, updatedAt: timestamp });
}
