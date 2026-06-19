import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { isCanonicalAuthor, normalizeAuthor } from "./authors.js";
import * as schema from "./db/schema.js";

const MAX_USERS = 2;

export function createAuth(db: any, options: { secret?: string; baseURL: string }) {
  return betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
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

    databaseHooks: {
      user: {
        create: {
          before: async (userData) => {
            const existing = await db
              .select({ id: schema.user.id })
              .from(schema.user)
              .limit(MAX_USERS);

            if (existing.length >= MAX_USERS) {
              throw new APIError("FORBIDDEN", {
                message: "Registration is closed. This space is just for two.",
              });
            }

            const author = normalizeAuthor(userData.name);
            if (!isCanonicalAuthor(author)) {
              throw new APIError("BAD_REQUEST", {
                message: "注册请选择身份：小圆子或小麟子",
              });
            }

            const taken = await db
              .select({ id: schema.user.id })
              .from(schema.user)
              .where(eq(schema.user.name, author))
              .get();

            if (taken) {
              throw new APIError("BAD_REQUEST", {
                message: "该身份已被另一位使用",
              });
            }

            return { data: { ...userData, name: author } };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
