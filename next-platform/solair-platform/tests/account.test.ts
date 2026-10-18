import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { Store } from "../server/db";
import { PostgresTestStore } from "./postgres-store";
import { seed } from "../server/seed";
import { createApp } from "../server/app";
let db: Store, server: Server, base: string;
const cookies: Record<string, string> = {};
async function request(path: string, cookie = "", body?: unknown) {
  return fetch(base + "/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
before(async () => {
  db = process.env.SOLAIR_TEST_POSTGRES === "1" ? new PostgresTestStore() : new Store(":memory:"); await db.migrate(); await seed(db);
  server = createServer(createApp(db));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  for (const role of ["operator", "driver", "admin"]) {
    const login = await request("/login", "", { email: `${role}@solair.local`, password: "SolairDemo!2026" });
    cookies[role] = login.headers.get("set-cookie")!.split(";")[0];
  }
});
after(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); await db.close(); });
const report = { summary: "Account menu issue", details: "A software-only test of persisted problem reports.", page: "Overview", mode: "hardware", vehicle_id: "ET-01" };
test("Problem reports require login, valid content and authorized vehicle context", async () => {
  assert.equal((await request("/problem-reports", "", report)).status, 401);
  assert.equal((await request("/problem-reports", cookies.driver, { ...report, vehicle_id: "ET-02" })).status, 403);
  assert.equal((await request("/problem-reports", cookies.driver, { ...report, details: " " })).status, 400);
});
test("Problem reports persist in the administrator audit trail with a receipt", async () => {
  const response = await request("/problem-reports", cookies.driver, report);
  assert.equal(response.status, 201);
  const receipt = await response.json();
  const rows = await db.query("SELECT * FROM audit_logs WHERE action='problem_report'");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].org_id, "manila");
  assert.equal(rows[0].user_id, "driver");
  assert.deepEqual(JSON.parse(rows[0].target), { id: receipt.id, ...report });
  assert.equal((await request("/audit", cookies.operator)).status, 403);
  const audit = await request("/audit", cookies.admin).then((r) => r.json());
  assert.ok(audit.some((row: { action: string }) => row.action === "problem_report"));
});
test("Logout closes its event stream, revokes its session and leaves other sessions valid", async () => {
  const response = await request("/events", cookies.operator);
  const reader = response.body!.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /event: ready/);
  const logout = await request("/logout", cookies.operator, {});
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie") || "", /session=;/);
  assert.equal((await reader.read()).done, true);
  assert.equal((await request("/me", cookies.operator)).status, 401);
  assert.equal((await request("/me", cookies.driver)).status, 200);
});
test("Logout is safe to repeat after expiry or without a session", async () => {
  assert.equal((await request("/logout", cookies.operator, {})).status, 200);
  assert.equal((await request("/logout", "", {})).status, 200);
});
