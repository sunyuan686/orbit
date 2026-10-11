import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "dotenv";

export const DEPLOY_CONFIG = "wrangler.local.toml";

export function renderDeployConfig(template: string, env: NodeJS.ProcessEnv): string {
  const databaseId = env.ORBIT_D1_DATABASE_ID?.trim();
  if (!databaseId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(databaseId)) {
    throw new Error("ORBIT_D1_DATABASE_ID must be a UUID");
  }
  if (!env.ORBIT_SITE_URL || !URL.canParse(env.ORBIT_SITE_URL)) {
    throw new Error("ORBIT_SITE_URL must be an HTTPS custom-domain origin");
  }
  const site = new URL(env.ORBIT_SITE_URL);
  if (
    site.protocol !== "https:" || site.username || site.password ||
    site.port || site.pathname !== "/" || site.search || site.hash ||
    site.hostname === "example.com" || site.hostname.endsWith(".example.com")
  ) {
    throw new Error("ORBIT_SITE_URL must be an HTTPS custom-domain origin");
  }
  const publicKey = env.ORBIT_VAPID_PUBLIC_KEY?.trim() || "";
  if (publicKey && !/^[A-Za-z0-9_-]+$/.test(publicKey)) {
    throw new Error("ORBIT_VAPID_PUBLIC_KEY must be base64url");
  }
  const replacements: Record<string, string> = {
    REPLACE_WITH_YOUR_D1_DATABASE_ID: databaseId,
    REPLACE_WITH_YOUR_DOMAIN: site.hostname,
    REPLACE_WITH_YOUR_SITE_URL: site.origin,
    REPLACE_WITH_YOUR_VAPID_PUBLIC_KEY: publicKey,
  };
  for (const [placeholder, value] of Object.entries(replacements)) {
    const quoted = JSON.stringify(placeholder);
    if (template.split(quoted).length !== 2) {
      throw new Error(`Expected exactly one ${placeholder} in wrangler.toml`);
    }
    template = template.replace(quoted, JSON.stringify(value));
  }
  return template;
}

export function prepareDeployConfig(): string {
  const local = ".env.deploy.local";
  const env = {
    ...(existsSync(local) ? parse(readFileSync(local)) : {}),
    ...process.env,
  };
  const config = renderDeployConfig(readFileSync("wrangler.toml", "utf8"), env);
  writeFileSync(DEPLOY_CONFIG, config, { mode: 0o600 });
  return DEPLOY_CONFIG;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(`Generated ${prepareDeployConfig()}`);
}
