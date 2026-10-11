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
import {
  VOICE_TRANSCRIBE_MODES,
  type VoiceTranscribeMode,
} from "../app-settings.js";
import { AuditResourceType, recordAudit } from "../services/space/audit.js";
import { updateUserDisplayName } from "../services/space/user-signup.js";
import { isSpaceUserId } from "../services/space/space-authors.js";
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
  image?: string | null;
  birthday: AccountBirthday | null;
  voiceTranscribeMode: VoiceTranscribeMode;
  about: string | null;
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
      image: user.image,
      birthdaySolarMonth: user.birthdaySolarMonth,
      birthdaySolarDay: user.birthdaySolarDay,
      birthdayLunarMonth: user.birthdayLunarMonth,
      birthdayLunarDay: user.birthdayLunarDay,
      birthdayLunarLeapMonth: user.birthdayLunarLeapMonth,
      birthdayRemindCalendar: user.birthdayRemindCalendar,
      voiceTranscribeMode: user.voiceTranscribeMode,
      about: user.about,
    })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  if (!row) return null;
  const rawVoiceMode = row.voiceTranscribeMode;
  const voiceTranscribeMode: VoiceTranscribeMode =
    rawVoiceMode === "raw" || rawVoiceMode === "bullets" || rawVoiceMode === "formal"
      ? rawVoiceMode
      : "smooth";
  return {
    name: row.name,
    image: row.image ?? null,
    birthday: presentBirthday(birthdayFromRow(row)),
    voiceTranscribeMode,
    about: row.about ?? null,
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

    let body: {
      name?: string;
      image?: string | null;
      birthday?: unknown;
      voiceTranscribeMode?: unknown;
      about?: unknown;
      userId?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const hasName = typeof body.name === "string";
    const hasImage = body.image !== undefined;
    const hasBirthday = body.birthday !== undefined;
    const hasVoiceMode = typeof body.voiceTranscribeMode === "string";
    const hasAbout = body.about !== undefined;
    if (!hasName && !hasImage && !hasBirthday && !hasVoiceMode && !hasAbout) {
      return c.json({ error: "请提供要修改的个人信息" }, 400);
    }

    const db = await getDb(c);
    try {
      let name = session.author;
      const changed: string[] = [];

      if (hasName) {
        name = await updateUserDisplayName(db, session.userId, body.name!);
        changed.push("name");
      }

      if (hasImage) {
        const imageVal =
          typeof body.image === "string" && body.image.trim()
            ? body.image.trim()
            : null;
        await db
          .update(user)
          .set({
            image: imageVal,
            updatedAt: new Date(),
          })
          .where(eq(user.id, session.userId));
        changed.push("image");
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

      if (hasVoiceMode) {
        const mode = body.voiceTranscribeMode as string;
        if (
          mode === "smooth" ||
          mode === "raw" ||
          mode === "bullets" ||
          mode === "formal"
        ) {
          await db
            .update(user)
            .set({
              voiceTranscribeMode: mode,
              updatedAt: new Date(),
            })
            .where(eq(user.id, session.userId));
          changed.push("voiceTranscribeMode");
        } else {
          return c.json({ error: "语音转写模式无效" }, 400);
        }
      }

      if (hasAbout) {
        const aboutVal =
          typeof body.about === "string"
            ? body.about.trim()
            : null;
        const targetUserId =
          body.userId && (await isSpaceUserId(db, body.userId))
            ? body.userId
            : session.userId;
        await db
          .update(user)
          .set({
            about: aboutVal,
            updatedAt: new Date(),
          })
          .where(eq(user.id, targetUserId));
        changed.push("about");
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
