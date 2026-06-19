import { db } from "../db/index.js";
import { createAuth } from "../auth.js";
import { AUTH_BASE_URL } from "../config/auth.js";

export const auth = createAuth(db, {
  baseURL: AUTH_BASE_URL,
});

export type Auth = typeof auth;
