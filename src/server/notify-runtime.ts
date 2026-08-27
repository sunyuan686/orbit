import type { NotifyRuntime } from "../services/notify/notify.js";
import { resolvePublicBaseUrl } from "../lib/public-base-url.js";

export function getDevNotifyRuntime(): NotifyRuntime {
  return {
    baseUrl: resolvePublicBaseUrl("http://localhost:5173"),
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY,
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
    aiEnv: process.env as NotifyRuntime["aiEnv"],
  };
}
