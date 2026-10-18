CREATE TABLE IF NOT EXISTS registration_preferences (
  user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL CHECK(requested_role IN ('driver','operator')),
  created_at TEXT NOT NULL
);
