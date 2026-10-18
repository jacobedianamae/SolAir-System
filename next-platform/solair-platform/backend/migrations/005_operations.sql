-- Additive tables preserve the existing demo records and positional legacy inserts.
CREATE TABLE IF NOT EXISTS contact_preferences(
 user_id TEXT PRIMARY KEY REFERENCES profiles(id), phone_e164 TEXT,
 phone_verified_at TEXT, email_verified_at TEXT, sms_consent INTEGER NOT NULL DEFAULT 0,
 consent_at TEXT, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS access_requests(
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 identity_id TEXT, password_hash TEXT NOT NULL, phone_e164 TEXT NOT NULL,
 sms_consent INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL, reviewed_by TEXT, reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS device_operation(
 device_id TEXT PRIMARY KEY REFERENCES devices(id), commissioned INTEGER NOT NULL DEFAULT 0,
 operator_id TEXT REFERENCES profiles(id), evidence TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS archived_frames(
 telemetry_id TEXT PRIMARY KEY REFERENCES telemetry(id) ON DELETE CASCADE,
 reason TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS alarm_incidents(
 id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
 vehicle_id TEXT NOT NULL REFERENCES vehicles(id), device_id TEXT NOT NULL REFERENCES devices(id),
 boot_id TEXT NOT NULL, alarm_id TEXT NOT NULL, mode TEXT NOT NULL,
 causes_json TEXT NOT NULL, occurred_at TEXT, received_at TEXT NOT NULL,
 time_quality TEXT NOT NULL, location_json TEXT NOT NULL, alarm_reported INTEGER NOT NULL,
 siren_confirmed INTEGER NOT NULL DEFAULT 0, delayed INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'open', ack_by TEXT REFERENCES profiles(id), ack_at TEXT,
 UNIQUE(device_id,boot_id,alarm_id,mode)
);
CREATE TABLE IF NOT EXISTS sms_jobs(
 id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES alarm_incidents(id),
 user_id TEXT NOT NULL REFERENCES profiles(id), phone_e164 TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('queued','accepted','delivered','failed','unknown','suppressed','simulated')),
 reason TEXT NOT NULL, body TEXT NOT NULL, provider_id TEXT,
 attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at TEXT NOT NULL,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 UNIQUE(incident_id,phone_e164)
);
CREATE INDEX IF NOT EXISTS sms_pending ON sms_jobs(status,next_attempt_at);
CREATE TABLE IF NOT EXISTS sms_attempts(
 id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES sms_jobs(id),
 status TEXT NOT NULL, detail TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sms_cooldowns(
 vehicle_id TEXT NOT NULL, phone_e164 TEXT NOT NULL, sent_at TEXT NOT NULL,
 PRIMARY KEY(vehicle_id,phone_e164)
);
CREATE TABLE IF NOT EXISTS sms_budget(
 day TEXT PRIMARY KEY, reserved_segments INTEGER NOT NULL DEFAULT 0
);
