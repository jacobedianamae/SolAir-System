import { Store } from "./db";
export async function sweepOffline(db: Store, notify: (org: string) => void) {
  const devices = await db.query(
    "SELECT d.id,v.org_id FROM devices d JOIN vehicles v ON v.id=d.vehicle_id",
  );
  for (const d of devices) {
    const [t] = await db.query(
      "SELECT id,received_at FROM telemetry WHERE device_id=? AND mode='hardware' AND id NOT IN (SELECT telemetry_id FROM cpe_samples WHERE historical=1) AND id NOT IN (SELECT telemetry_id FROM archived_frames) ORDER BY received_at DESC LIMIT 1",
      [d.id],
    );
    if (!t || Date.now() - Date.parse(t.received_at) < 90000) continue;
    const id = `offline:${d.id}:${t.id}`;
    if (
      (await db.query("SELECT id FROM security_events WHERE id=?", [id])).length
    )
      continue;
    await db.run(
      "INSERT INTO security_events VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      [id, d.id, "hardware", "Device offline", new Date().toISOString(), null],
    );
    notify(d.org_id);
  }
}
