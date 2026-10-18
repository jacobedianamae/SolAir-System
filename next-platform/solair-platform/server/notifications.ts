import type { Store } from "./db";
import type { User } from "./auth";
import type { ActivityNotification } from "../packages/notifications";

export async function notifications(db: Store, user: User, mode: "demo" | "hardware"): Promise<ActivityNotification[]> {
  const driver = user.role === "driver";
  // Apply organization and assignment restrictions before limiting source records.
  const access = driver ? " AND EXISTS (SELECT 1 FROM assignments a WHERE a.vehicle_id=v.id AND a.driver_id=?)" : "";
  const args = driver ? [user.org_id, mode, user.id] : [user.org_id, mode];
  // CPE v2 metering is displayed as its own channel; bench/output power is not proof of harvested PV/wind energy.
  const [events, energy, help, messages, audits, fleet] = await Promise.all([
    db.query(`SELECT e.*,v.id AS vehicle_id FROM security_events e JOIN devices d ON d.id=e.device_id JOIN vehicles v ON v.id=d.vehicle_id WHERE v.org_id=? AND e.mode=?${access} ORDER BY e.created_at DESC LIMIT 50`, args),
    db.query(`SELECT e.device_id,e.source,substr(e.measured_at,1,10) AS day,SUM(e.increment_wh) AS wh,MAX(e.measured_at) AS measured_at,v.id AS vehicle_id FROM energy_measurements e JOIN devices d ON d.id=e.device_id JOIN vehicles v ON v.id=d.vehicle_id WHERE v.org_id=? AND e.mode=?${access} AND e.power_w IS NOT NULL AND e.increment_wh>0 AND NOT EXISTS (SELECT 1 FROM cpe_samples c WHERE c.telemetry_id=e.telemetry_id) GROUP BY e.device_id,e.source,substr(e.measured_at,1,10),v.id ORDER BY MAX(e.measured_at) DESC LIMIT 30`, args),
    db.query(`SELECT h.* FROM help_requests h JOIN vehicles v ON v.id=h.vehicle_id WHERE h.org_id=? AND h.mode=?${access}${driver ? " AND h.driver_id=?" : ""} ORDER BY h.updated_at DESC LIMIT 30`, driver ? [...args, user.id] : args),
    db.query(`SELECT m.*,p.name AS sender_name FROM messages m JOIN profiles p ON p.id=m.sender_id JOIN vehicles v ON v.id=m.vehicle_id WHERE m.org_id=? AND m.mode=?${access} AND m.sender_id<>? ORDER BY m.created_at DESC LIMIT 30`, [...args, user.id]),
    db.query("SELECT id,action,target,created_at FROM audit_logs WHERE org_id=? AND action IN ('vehicle_created','vehicle_assigned','vehicle_image_uploaded','device_credential_rotated','calibration_recorded','account_updated') ORDER BY created_at DESC LIMIT 80", [user.org_id]),
    db.query(`SELECT v.id,d.id AS device_id FROM vehicles v LEFT JOIN devices d ON d.vehicle_id=v.id WHERE v.org_id=?${access} ORDER BY v.id`, driver ? [user.org_id, user.id] : [user.org_id]),
  ]);
  const items: ActivityNotification[] = [];
  for (const e of events) {
    const alert = /offline|fault|unavailable/i.test(e.type);
    items.push({ id: `security:${e.id}`, revision: `security:${e.id}`, category: alert ? "alert" : "security", title: e.type, body: `${e.vehicle_id} · ${e.ack_by ? "Acknowledged" : "Recorded event — review details"}`, created_at: e.created_at, source: mode, vehicle_id: e.vehicle_id, page: "Security" });
  }
  for (const e of energy) {
    const amount = Number(e.wh);
    if (!Number.isFinite(amount) || amount <= 0 || !["solar", "wind"].includes(e.source)) continue;
    const id = `energy:${mode}:${e.device_id}:${e.source}:${e.day}`;
    items.push({ id, revision: `${id}:${amount.toFixed(2)}`, category: "energy", title: `${e.source === "solar" ? "Solar" : "Wind"} energy harvested`, body: `${e.vehicle_id} · +${amount.toFixed(2)} Wh recorded on ${e.day} (UTC)`, created_at: e.measured_at, source: mode, vehicle_id: e.vehicle_id, page: "Energy" });
  }
  for (const h of help) {
    items.push({ id: `help:${h.id}`, revision: `help:${h.id}:${h.status}`, category: "assistance", title: `${h.type} · ${h.status}`, body: `${h.vehicle_id} · ${h.notes.slice(0, 120)}`, created_at: h.updated_at, source: mode, vehicle_id: h.vehicle_id, page: "SOS & Assistance" });
  }
  for (const m of messages) {
    items.push({ id: `message:${m.id}`, revision: `message:${m.id}`, category: "message", title: `Message received · ${m.vehicle_id}`, body: `${m.sender_name}: ${m.body.slice(0, 120)}`, created_at: m.created_at, source: mode, vehicle_id: m.vehicle_id, page: "Messages" });
  }
  const labels: Record<string, string> = { vehicle_created: "Vehicle registered", vehicle_assigned: "Driver assignment updated", vehicle_image_uploaded: "Vehicle image updated", device_credential_rotated: "Device credentials updated", calibration_recorded: "Calibration recorded", account_updated: "Account updated" };
  for (const entry of audits) {
    const vehicle = fleet.find((v) => v.id === entry.target || v.device_id === entry.target);
    if (!vehicle && !(entry.action === "account_updated" && entry.target === user.id)) continue;
    items.push({ id: `system:${entry.id}`, revision: `system:${entry.id}`, category: "system", title: labels[entry.action], body: vehicle ? `${vehicle.id} · Recorded system activity` : "Your SOLAIR account was updated", created_at: entry.created_at, source: "system", vehicle_id: vehicle?.id || null, page: entry.action === "calibration_recorded" && ["engineer", "admin"].includes(user.role) ? "CPE Lab" : "Settings" });
  }
  return items.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || a.id.localeCompare(b.id)).slice(0, 50);
}
