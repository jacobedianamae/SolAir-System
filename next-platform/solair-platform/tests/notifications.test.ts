import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { Store } from "../server/db";
import { PostgresTestStore } from "./postgres-store";
import { seed } from "../server/seed";
import { createApp } from "../server/app";
import type { ActivityNotification } from "../packages/notifications";
let db: Store, server: Server, base: string;
const cookies: Record<string, string> = {};
async function feed(role = "", mode = "hardware") {
  const response = await fetch(`${base}/api/notifications?mode=${mode}`, { headers: { Cookie: cookies[role] || "" } });
  return { status: response.status, data: await response.json() as ActivityNotification[] };
}
before(async () => {
  db = process.env.SOLAIR_TEST_POSTGRES === "1" ? new PostgresTestStore() : new Store(":memory:"); await db.migrate(); await seed(db);
  server = createServer(createApp(db));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  for (const role of ["operator", "driver", "outsider"]) {
    const response = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: `${role}@solair.local`, password: "SolairDemo!2026" }) });
    cookies[role] = response.headers.get("set-cookie")!.split(";")[0];
  }
  await db.run("INSERT INTO telemetry VALUES (?,?,?,?,?,?,?,?)", ["notification-frame", "SOL-ET-01", "hardware", "notification-test", 1, "2026-10-18T00:00:00Z", "2026-10-18T00:00:00Z", "{}"]);
  for (const [id, wh, power] of [["positive", 1.25, 100], ["zero", 0, 100], ["absent", 0, null]] as const) {
    await db.run("INSERT INTO energy_measurements VALUES (?,?,?,?,?,?,?,?)", [id, "notification-frame", "SOL-ET-01", "hardware", "solar", power, wh, "2026-10-18T00:00:00Z"]);
  }
  await db.run("INSERT INTO security_events VALUES (?,?,?,?,?,?)", ["allowed-event", "SOL-ET-01", "hardware", "lid", "2026-10-18T00:00:00Z", null]);
  await db.run("INSERT INTO security_events VALUES (?,?,?,?,?,?)", ["fault-event", "SOL-ET-01", "hardware", "Device offline", "2026-10-18T00:00:01Z", null]);
  for (let i = 0; i < 60; i++) await db.run("INSERT INTO security_events VALUES (?,?,?,?,?,?)", [`other-assignment-${i}`, "SOL-ET-02", "hardware", "mount", "2026-10-18T01:00:00Z", null]);
  await db.run("INSERT INTO messages VALUES (?,?,?,?,?,?,?,?)", ["notification-message", "manila", "ET-01", "operator", "hardware", "Check the vehicle", "2026-10-18T00:00:02Z", null]);
  await db.run("INSERT INTO help_requests VALUES (?,?,?,?,?,?,?,?,?,?)", ["notification-help", "manila", "ET-01", "driver", "hardware", "Mechanical assistance", "Review test", "acknowledged", "2026-10-18T00:00:00Z", "2026-10-18T00:00:03Z"]);
  await db.run("INSERT INTO audit_logs VALUES (?,?,?,?,?,?)", ["system-assignment", "manila", "operator", "vehicle_assigned", "ET-01", "2026-10-18T00:00:04Z"]);
  await db.run("INSERT INTO audit_logs VALUES (?,?,?,?,?,?)", ["private-report", "manila", "operator", "problem_report", "private report detail", "2026-10-18T00:00:05Z"]);
});
after(async () => { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); await db.close(); });
test("Notification API requires authentication and filters assignment before limiting", async () => {
  assert.equal((await feed()).status, 401);
  const driver = (await feed("driver")).data;
  assert.ok(driver.some((item) => item.id === "security:allowed-event"));
  assert.ok(driver.every((item) => item.vehicle_id === "ET-01"));
  assert.deepEqual((await feed("outsider")).data, []);
});
test("Feed includes real security, alerts, assistance, messages and sanitized system activity", async () => {
  const items = (await feed("driver")).data;
  for (const category of ["security", "alert", "assistance", "message", "system"]) assert.ok(items.some((item) => item.category === category));
  assert.ok(items.some((item) => item.title === "Driver assignment updated" && item.source === "system"));
  assert.ok(!JSON.stringify(items).includes("private report detail"));
  assert.ok(items.every((item, index) => !index || Date.parse(items[index - 1].created_at) >= Date.parse(item.created_at)));
});
test("Harvest notifications use positive recorded Wh and update a stable daily entry", async () => {
  const energy = (await feed("driver")).data.filter((item) => item.category === "energy");
  assert.equal(energy.length, 1); assert.match(energy[0].body, /\+1\.25 Wh/);
  await db.run("UPDATE energy_measurements SET increment_wh=2.5 WHERE id='positive'");
  const updated = (await feed("driver")).data.find((item) => item.category === "energy")!;
  assert.equal(updated.id, energy[0].id); assert.notEqual(updated.revision, energy[0].revision);
  assert.match(updated.body, /\+2\.50 Wh/);
});
test("Demonstration and hardware activity stay partitioned; system updates are explicit", async () => {
  const demo = (await feed("operator", "demo")).data;
  assert.ok(demo.some((item) => item.source === "demo" && item.category === "energy"));
  assert.ok(demo.every((item) => item.source === "demo" || item.source === "system"));
  assert.ok(!demo.some((item) => item.id === "security:allowed-event"));
  const real = (await feed("driver")).data;
  assert.ok(real.every((item) => item.source === "hardware" || item.source === "system"));
});

test("CPE bench, MPPT output and recovered frames cannot be advertised as harvested PV or wind", async () => {
  for (const [id, load, historical] of [["bench", "bench_resistor", 0], ["output", "vehicle_charging", 0], ["recovered", "bench_resistor", 1]] as const) {
    await db.run("INSERT INTO telemetry VALUES (?,?,?,?,?,?,?,?)", [id, "SOL-ET-01", "hardware", "cpe-notifications", historical + (id === "bench" ? 1 : 3), "2026-10-18T00:02:00Z", "2026-10-18T00:02:00Z", "{}"]);
    await db.run("INSERT INTO cpe_samples VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", [id, "SOL-ET-01", "hardware", load, "2026-10-18T00:02:00Z", null, 12, 1, 12, 999, null, 0, 0, "{}", historical]);
    await db.run("INSERT INTO energy_measurements VALUES (?,?,?,?,?,?,?,?)", [`cpe-${id}`, id, "SOL-ET-01", "hardware", "solar", 12, 999, "2026-10-18T00:02:00Z"]);
  }
  const energy = (await feed("driver")).data.filter((item) => item.category === "energy");
  assert.equal(energy.length, 1);
  assert.match(energy[0].body, /\+2\.50 Wh/);
  assert.ok(!energy[0].body.includes("999"));
});
