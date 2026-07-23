import { Hono } from "hono";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { user } from "../db/schema.js";
import {
  birthdayFromRow,
  formatLunarBirthdayCn,
  formatSolarBirthdayCn,
  parseBirthdayInput,
  type BirthdayProfile,
  type LunarBirthday,
  type SolarBirthday,
} from "../lib/birthday.js";
import { AuditResourceType, recordAudit } from "../services/audit.js";
import { updateUserDisplayName } from "../services/user-signup.js";
import { getRequestId } from "../lib/request-context.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface AccountRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
}

export interface AccountBirthday {
  solar: (SolarBirthday & { label: string }) | null;
  lunar: (LunarBirthday & { label: string }) | null;
  remindCalendar: BirthdayProfile["remindCalendar"];
}

export interface AccountProfile {
  name: string;
  birthday: AccountBirthday | null;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: AccountRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) return c.json({ error: INVALID_SESSION_ERROR }, 400);
  return sessionAuthor;
}

function presentBirthday(value: BirthdayProfile | null): AccountProfile["birthday"] {
  if (!value) return null;
  return {
    solar: value.solar
      ? { ...value.solar, label: formatSolarBirthdayCn(value.solar) }
      : null,
    lunar: value.lunar
      ? { ...value.lunar, label: formatLunarBirthdayCn(value.lunar) }
      : null,
    remindCalendar: value.remindCalendar,
  };
}

async function loadAccountProfile(
  db: any,
  userId: string
): Promise<AccountProfile | null> {
  const row = await db
    .select({
      name: user.name,
      birthdaySolarMonth: user.birthdaySolarMonth,
      birthdaySolarDay: user.birthdaySolarDay,
      birthdayLunarMonth: user.birthdayLunarMonth,
      birthdayLunarDay: user.birthdayLunarDay,
      birthdayLunarLeapMonth: user.birthdayLunarLeapMonth,
      birthdayRemindCalendar: user.birthdayRemindCalendar,
    })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  if (!row) return null;
  return {
    name: row.name,
    birthday: presentBirthday(birthdayFromRow(row)),
  };
}

export function createAccountRoutes(
  getDb: DbProvider,
  options: AccountRouteOptions = {}
) {
  const account = new Hono();

  account.get("/profile", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const profile = await loadAccountProfile(db, session.userId);
    if (!profile) return c.json({ error: "用户不存在" }, 404);
    return c.json(profile satisfies AccountProfile);
  });

  account.put("/profile", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { name?: string; birthday?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const hasName = typeof body.name === "string";
    const hasBirthday = body.birthday !== undefined;
    if (!hasName && !hasBirthday) {
      return c.json({ error: "请提供爱称或生日" }, 400);
    }

    const db = await getDb(c);
    try {
      let name = session.author;
      const changed: string[] = [];

      if (hasName) {
        name = await updateUserDisplayName(db, session.userId, body.name!);
        changed.push("name");
      }

      if (hasBirthday) {
        const parsed = parseBirthdayInput(body.birthday);
        if (!parsed.ok) {
          return c.json({ error: parsed.error }, 400);
        }
        const next = parsed.value;
        await db
          .update(user)
          .set({
            birthdaySolarMonth: next?.solar?.month ?? null,
            birthdaySolarDay: next?.solar?.day ?? null,
            birthdayLunarMonth: next?.lunar?.month ?? null,
            birthdayLunarDay: next?.lunar?.day ?? null,
            birthdayLunarLeapMonth: next?.lunar?.leapMonth ?? false,
            birthdayRemindCalendar: next?.remindCalendar ?? null,
            updatedAt: new Date(),
          })
          .where(eq(user.id, session.userId));
        changed.push("birthday");
      }

      if (changed.length > 0) {
        await recordAudit(db, {
          userId: session.userId,
          author: name,
          action: "account.profile.update",
          resourceType: AuditResourceType.SPACE,
          resourceId: session.userId,
          metadata: { fields: changed },
          requestId: getRequestId(c),
        });
      }

      const profile = await loadAccountProfile(db, session.userId);
      if (!profile) return c.json({ error: "用户不存在" }, 404);
      return c.json(profile satisfies AccountProfile);
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败";
      return c.json({ error: message }, 400);
    }
  });

  return account;
}
