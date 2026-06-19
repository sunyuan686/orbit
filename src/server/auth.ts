import { db } from "../db/index.js";
import { createAuth } from "../auth.js";

export const auth = createAuth(db, {
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
});

export type Auth = typeof auth;
