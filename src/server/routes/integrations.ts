import { db } from "../../db/index.js";
import { createIntegrationsRoutes } from "../../api/integrations.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

import type { NotifyRuntime } from "../../services/notify.js";

function getNotifyRuntime(): NotifyRuntime {
  return {
    baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    aiEnv: process.env as NotifyRuntime["aiEnv"],
  };
}

const integrations = createIntegrationsRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
  getSecret: () => process.env.BETTER_AUTH_SECRET,
  getWebhookBaseUrl: () =>
    process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  getNotifyRuntime: () => getNotifyRuntime(),
  getAiEnv: () => getNotifyRuntime().aiEnv,
  saveAsset: async ({ filename, mimeType, body }) => {
    const dir = join(process.cwd(), "data");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), Buffer.from(body));
    return `/assets/${filename}`;
  },
});

export { integrations };
