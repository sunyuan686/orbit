import { eq, lt } from "drizzle-orm";
import { feishuMessageDedup } from "../../db/schema.js";

const DEDUP_TTL_SECONDS = 24 * 60 * 60;

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export async function tryClaimFeishuMessage(
  db: any,
  messageId: string
): Promise<boolean> {
  const existing = await db
    .select({ messageId: feishuMessageDedup.messageId })
    .from(feishuMessageDedup)
    .where(eq(feishuMessageDedup.messageId, messageId))
    .get();
  if (existing) return false;

  try {
    await db.insert(feishuMessageDedup).values({
      messageId,
      createdAt: now(),
    });
    return true;
  } catch {
    return false;
  }
}

export async function pruneFeishuMessageDedup(db: any): Promise<void> {
  const cutoff = now() - DEDUP_TTL_SECONDS;
  await db
    .delete(feishuMessageDedup)
    .where(lt(feishuMessageDedup.createdAt, cutoff));
}
