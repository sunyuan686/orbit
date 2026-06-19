import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
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

            return { data: userData };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
