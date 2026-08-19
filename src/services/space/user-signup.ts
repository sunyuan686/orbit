import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { account, user } from "../../db/schema.js";
import {
  MAX_SPACE_USERS,
  countUsers,
  getSpaceAuthors,
} from "./space-authors.js";
import {
  normalizeDisplayName,
  validateDisplayName,
} from "../../lib/display-name.js";

function nowDate(): Date {
  return new Date();
}

function generateId(): string {
  return crypto.randomUUID();
}

export interface CreateSpaceUserInput {
  email: string;
  password: string;
  displayName: string;
}

export async function createSpaceUser(
  db: any,
  input: CreateSpaceUserInput
): Promise<{ userId: string; name: string; email: string }> {
  const userCount = await countUsers(db);
  if (userCount >= MAX_SPACE_USERS) {
    throw new Error("SPACE_FULL");
  }

  const existingAuthors = await getSpaceAuthors(db);
  const validation = validateDisplayName(input.displayName, {
    otherNames: existingAuthors.map((row) => row.name),
  });
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("邮箱不能为空");

  const taken = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .get();
  if (taken) throw new Error("该邮箱已被使用");

  const userId = generateId();
  const accountId = generateId();
  const timestamp = nowDate();
  const passwordHash = await hashPassword(input.password);

  await db.insert(user).values({
    id: userId,
    name: validation.name,
    email,
    emailVerified: false,
    image: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  await db.insert(account).values({
    id: accountId,
    accountId: email,
    providerId: "credential",
    userId,
    password: passwordHash,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return { userId, name: validation.name, email };
}

export async function updateUserDisplayName(
  db: any,
  userId: string,
  rawName: string
): Promise<string> {
  const authors = await getSpaceAuthors(db);
  const others = authors.filter((row) => row.id !== userId).map((row) => row.name);
  const validation = validateDisplayName(rawName, { otherNames: others });
  if (!validation.ok) throw new Error(validation.error);

  await db
    .update(user)
    .set({ name: validation.name, updatedAt: nowDate() })
    .where(eq(user.id, userId));

  return validation.name;
}
