import './env';
import { Store } from "./db";
import {redactOperationalHistory} from './operations';
const days = Number(process.env.SOLAIR_LOCATION_RETENTION_DAYS || 30);
if (!Number.isFinite(days) || days < 1)
  throw new Error("Retention must be at least one day");
const db = new Store(),
  cutoff = new Date(Date.now() - days * 86400000).toISOString();
// Telemetry includes GPS coordinates; remove related energy/GPS rows before source frames.
await db.transaction(async (tx) => {
  await redactOperationalHistory(tx,cutoff);
  await tx.run("DELETE FROM gps_records WHERE measured_at<?", [cutoff]);
  await tx.run(
    "DELETE FROM energy_measurements WHERE telemetry_id IN (SELECT id FROM telemetry WHERE received_at<?)",
    [cutoff],
  );
  await tx.run(
    "DELETE FROM gps_records WHERE telemetry_id IN (SELECT id FROM telemetry WHERE received_at<?)",
    [cutoff],
  );
  await tx.run("DELETE FROM telemetry WHERE received_at<?", [cutoff]);
  await tx.run("DELETE FROM sessions WHERE expires_at<?", [
    new Date().toISOString(),
  ]);
});
await db.close();
console.log(
  `Expired location-bearing telemetry removed under ${days}-day policy.`,
);
