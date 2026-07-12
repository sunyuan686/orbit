import { and, desc, eq, isNull } from "drizzle-orm";
import { apiToken } from "../db/schema.js";
import type { SessionAuthor } from "../api/session-author.js";
import { generateId } from "../lib/id.js";

export const API_TOKEN_PREFIX = "orb_";
export const MAX_API_TOKENS = 10;

const TOKEN_BYTE_LENGTH = 24;

export interface ApiTokenListItem {
  id: string;
  name: string;
  tokenPrefix: string;
  author: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface CreateApiTokenResult extends ApiTokenListItem {
  token: string;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function generateApiTokenValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTE_LENGTH));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${API_TOKEN_PREFIX}${hex}`;
}

export function isApiTokenFormat(token: string): boolean {
  return token.startsWith(API_TOKEN_PREFIX) && token.length === API_TOKEN_PREFIX.length + TOKEN_BYTE_LENGTH * 2;
}

export async function hashApiToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

function tokenPrefixFromValue(token: string): string {
  return token.slice(0, 12);
}

export async function verifyApiToken(
  db: any,
  token: string
): Promise<{ author: SessionAuthor; tokenId: string } | null> {
  if (!isApiTokenFormat(token)) return null;

  const tokenHash = await hashApiToken(token);
  const row = await db
    .select({
      id: apiToken.id,
      userId: apiToken.userId,
      author: apiToken.author,
      revokedAt: apiToken.revokedAt,
    })
    .from(apiToken)
    .where(eq(apiToken.tokenHash, tokenHash))
    .get();

  if (!row || row.revokedAt) return null;

  const timestamp = now();
  await db
    .update(apiToken)
    .set({ lastUsedAt: timestamp, updatedAt: timestamp })
    .where(eq(apiToken.id, row.id));

  return {
    tokenId: row.id,
    author: {
      userId: row.userId,
      author: row.author.trim() || "unknown",
    },
  };
}

export async function listApiTokens(db: any): Promise<ApiTokenListItem[]> {
  const rows = await db
    .select({
      id: apiToken.id,
      name: apiToken.name,
      tokenPrefix: apiToken.tokenPrefix,
      author: apiToken.author,
      createdAt: apiToken.createdAt,
      lastUsedAt: apiToken.lastUsedAt,
    })
    .from(apiToken)
    .where(isNull(apiToken.revokedAt))
    .orderBy(desc(apiToken.createdAt));

  return rows.map((row: ApiTokenListItem) => ({
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    author: row.author,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  }));
}

export async function countActiveApiTokens(db: any): Promise<number> {
  const rows = await db
    .select({ id: apiToken.id })
    .from(apiToken)
    .where(isNull(apiToken.revokedAt));
  return rows.length;
}

export async function createApiToken(
  db: any,
  input: { name: string; sessionAuthor: SessionAuthor }
): Promise<CreateApiTokenResult> {
  const name = input.name.trim();
  if (!name) throw new Error("TOKEN_NAME_REQUIRED");
  if (name.length > 64) throw new Error("TOKEN_NAME_TOO_LONG");

  const activeCount = await countActiveApiTokens(db);
  if (activeCount >= MAX_API_TOKENS) throw new Error("TOKEN_LIMIT_REACHED");

  const token = generateApiTokenValue();
  const tokenHash = await hashApiToken(token);
  const id = generateId("atk");
  const timestamp = now();

  await db.insert(apiToken).values({
    id,
    name,
    tokenHash,
    tokenPrefix: tokenPrefixFromValue(token),
    userId: input.sessionAuthor.userId,
    author: input.sessionAuthor.author,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return {
    id,
    name,
    token,
    tokenPrefix: tokenPrefixFromValue(token),
    author: input.sessionAuthor.author,
    createdAt: timestamp,
    lastUsedAt: null,
  };
}

export async function revokeApiToken(
  db: any,
  tokenId: string
): Promise<boolean> {
  const row = await db
    .select({ id: apiToken.id, revokedAt: apiToken.revokedAt })
    .from(apiToken)
    .where(eq(apiToken.id, tokenId))
    .get();

  if (!row || row.revokedAt) return false;

  const timestamp = now();
  await db
    .update(apiToken)
    .set({ revokedAt: timestamp, updatedAt: timestamp })
    .where(eq(apiToken.id, tokenId));

  return true;
}

export async function getApiTokenForRevoke(
  db: any,
  tokenId: string
): Promise<{ id: string; name: string } | null> {
  const row = await db
    .select({ id: apiToken.id, name: apiToken.name, revokedAt: apiToken.revokedAt })
    .from(apiToken)
    .where(and(eq(apiToken.id, tokenId), isNull(apiToken.revokedAt)))
    .get();

  if (!row) return null;
  return { id: row.id, name: row.name };
}
