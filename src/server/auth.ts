import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { db } from "../db/index.js";
import * as schema from "../db/schema.js";

const MAX_USERS = 2;

export const auth = betterAuth({
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
    expiresIn: 60 * 60 * 24 * 30, // 30 天
    updateAge: 60 * 60 * 24,       // 每天刷新一次
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

          return { data: userData };
        },
      },
    },
  },
});

export type Auth = typeof auth;
