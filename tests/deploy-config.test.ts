import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { renderDeployConfig } from "../scripts/deploy-config.js";

const template = readFileSync("wrangler.toml", "utf8");
const env = {
  ORBIT_D1_DATABASE_ID: "11111111-2222-3333-4444-555555555555",
  ORBIT_SITE_URL: "https://deploy.example/",
  ORBIT_VAPID_PUBLIC_KEY: "example_public_key",
};

describe("shared deployment configuration", () => {
  it("renders the configured resources without changing shared bindings", () => {
    const rendered = renderDeployConfig(template, env);
    assert.ok(rendered.includes(`database_id = "${env.ORBIT_D1_DATABASE_ID}"`));
    assert.ok(rendered.includes('pattern = "deploy.example"'));
    assert.ok(rendered.includes('BETTER_AUTH_URL = "https://deploy.example"'));
    assert.ok(rendered.includes('VAPID_PUBLIC_KEY = "example_public_key"'));
    assert.ok(rendered.includes('migrations_dir = "src/db/migrations"'));
    assert.ok(!rendered.includes("REPLACE_WITH_YOUR_"));
    assert.ok(renderDeployConfig(template, { ...env, ORBIT_VAPID_PUBLIC_KEY: "" })
      .includes('VAPID_PUBLIC_KEY = ""'));
  });

  it("rejects missing, placeholder, and unsafe deployment values", () => {
    assert.throws(() => renderDeployConfig(template, {}), /ORBIT_D1_DATABASE_ID/);
    assert.throws(() => renderDeployConfig(template, {
      ...env, ORBIT_D1_DATABASE_ID: 'invalid"\nname = "other"',
    }), /ORBIT_D1_DATABASE_ID/);
    for (const value of ["", "not a URL", "http://deploy.example", "https://example.com",
      "https://deploy.example/path", "https://user:pass@deploy.example",
      "https://deploy.example?config=other", "https://deploy.example:444"]) {
      assert.throws(() => renderDeployConfig(template, { ...env, ORBIT_SITE_URL: value }),
        /ORBIT_SITE_URL/);
    }
    assert.throws(() => renderDeployConfig(template, {
      ...env, ORBIT_VAPID_PUBLIC_KEY: '"\nname = "other"',
    }), /ORBIT_VAPID_PUBLIC_KEY/);
  });

  it("fails when the template no longer has one value for each deployment parameter", () => {
    assert.throws(() => renderDeployConfig(template.replace(
      '"REPLACE_WITH_YOUR_DOMAIN"', '"fixed.example"',
    ), env), /exactly one/);
    assert.throws(() => renderDeployConfig(
      `${template}\nother = "REPLACE_WITH_YOUR_DOMAIN"`, env,
    ), /exactly one/);
  });

  it("uses local parameters by default and lets CI environment override them", () => {
    const directory = mkdtempSync(join(tmpdir(), "orbit-deploy-config-"));
    try {
      writeFileSync(join(directory, "wrangler.toml"), template);
      writeFileSync(join(directory, ".env.deploy.local"),
        Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n"));
      const processEnv = Object.fromEntries(
        Object.entries(process.env).filter(([key]) => !key.startsWith("ORBIT_")),
      );
      for (const override of [undefined, "https://ci.example"]) {
        const result = spawnSync(resolve("node_modules/.bin/tsx"),
          [resolve("scripts/deploy-config.ts")], {
            cwd: directory,
            env: { ...processEnv, ...(override ? { ORBIT_SITE_URL: override } : {}) },
            encoding: "utf8",
          });
        assert.equal(result.status, 0, result.stderr);
        const config = readFileSync(join(directory, "wrangler.local.toml"), "utf8");
        assert.ok(config.includes(`BETTER_AUTH_URL = "${override || "https://deploy.example"}"`));
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
