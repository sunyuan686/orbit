import { db } from "../../db/index.js";
import { createIntegrationsRoutes } from "../../api/integrations.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { resolvePublicBaseUrl } from "../../lib/public-base-url.js";
import { getDevNotifyRuntime } from "../notify-runtime.js";

const integrations = createIntegrationsRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
  getSecret: () => process.env.BETTER_AUTH_SECRET,
  getWebhookBaseUrl: () => resolvePublicBaseUrl("http://localhost:5173"),
  getNotifyRuntime: () => getDevNotifyRuntime(),
  getAiEnv: () => getDevNotifyRuntime().aiEnv,
  saveAsset: async ({ filename, mimeType, body }) => {
    const dir = join(process.cwd(), "data", "assets");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), Buffer.from(body));
    return `/assets/${filename}`;
  },
});

export { integrations };
