import { it } from "node:test";
import assert from "node:assert/strict";
import worker, { type Env } from "../src/worker.js";

it("resolves CORS from the configured site while rejecting unrelated origins", async () => {
  for (const siteOrigin of ["https://example.com", "https://another.example"]) {
    for (const origin of [siteOrigin, "http://localhost:5173", "https://untrusted.example"]) {
      const response = await worker.fetch(
        new Request(`${siteOrigin}/api/account/profile`, {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "PUT",
          },
        }),
        { BETTER_AUTH_URL: `${siteOrigin}/` } as Env,
      );
      assert.equal(response.status, 204);
      assert.equal(
        response.headers.get("Access-Control-Allow-Origin"),
        origin === "https://untrusted.example" ? siteOrigin : origin,
      );
      assert.equal(response.headers.get("Access-Control-Allow-Credentials"), "true");
    }
  }
});
