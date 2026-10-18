CREATE TABLE IF NOT EXISTS profile_registration(user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,vehicle_brand TEXT CHECK(vehicle_brand IN ('BEMAC','NWOW')),display_name TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS operator_information(user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,business_name TEXT NOT NULL DEFAULT '',service_area TEXT NOT NULL DEFAULT '',public_phone TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS vehicle_operators(vehicle_id TEXT PRIMARY KEY REFERENCES vehicles(id),operator_id TEXT NOT NULL REFERENCES profiles(id));
CREATE TABLE IF NOT EXISTS activity_details(audit_id TEXT PRIMARY KEY REFERENCES audit_logs(id) ON DELETE CASCADE,description TEXT NOT NULL);
