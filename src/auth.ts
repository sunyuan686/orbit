import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { DEV_FRONTEND_ORIGINS } from "./config/auth.js";
import * as schema from "./db/schema.js";
import {
  MAX_SPACE_USERS,
  countUsers,
  getSpaceAuthors,
} from "./services/space/space-authors.js";
import {
  normalizeDisplayName,
  validateDisplayName,
} from "./lib/display-name.js";

export function createAuth(db: any, options: { secret?: string; baseURL: string }) {
  const extraTrustedOrigins = DEV_FRONTEND_ORIGINS.filter(
    (origin) => origin !== options.baseURL
  );

  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: extraTrustedOrigins,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },

    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },

    user: {
      changeEmail: {
        enabled: true,
        updateEmailWithoutVerification: true,
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (userData) => {
            const userCount = await countUsers(db);
            if (userCount >= MAX_SPACE_USERS) {
              throw new APIError("FORBIDDEN", {
                message: "Registration is closed. This space is just for two.",
              });
            }

            // 第二人仅能通过邀请链接注册（/api/invite/:token/accept）
            if (userCount >= 1) {
              throw new APIError("FORBIDDEN", {
                message: "请通过邀请链接加入空间",
              });
            }

            const authors = await getSpaceAuthors(db);
            const validation = validateDisplayName(userData.name, {
              otherNames: authors.map((row) => row.name),
            });
            if (!validation.ok) {
              throw new APIError("BAD_REQUEST", { message: validation.error });
            }

            const taken = await db
              .select({ id: schema.user.id })
              .from(schema.user)
              .where(eq(schema.user.name, validation.name))
              .get();
            if (taken) {
              throw new APIError("BAD_REQUEST", {
                message: "该爱称已被另一位使用",
              });
            }

            return { data: { ...userData, name: validation.name } };
          },
        },
        update: {
          before: async (userData) => {
            if (typeof userData.name !== "string") return { data: userData };
            const trimmed = normalizeDisplayName(userData.name);
            if (!trimmed) {
              throw new APIError("BAD_REQUEST", { message: "爱称不能为空" });
            }
            return { data: { ...userData, name: trimmed } };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
