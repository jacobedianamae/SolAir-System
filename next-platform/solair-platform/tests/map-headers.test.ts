import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Store } from "../server/db";
import { createApp } from "../server/app";

for (const production of [false, true]) {
  test(`Map request policy permits origin referrers (${production ? "production" : "development"})`, async () => {
    const db = new Store(":memory:");
    const server = createServer(createApp(db, production));
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      assert.ok(address && typeof address !== "string");
      const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
      assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
      if (production) {
        assert.match(response.headers.get("content-security-policy") || "", /img-src[^;]*https:\/\/tile\.openstreetmap\.org/);
      }
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.close();
    }
  });
}
