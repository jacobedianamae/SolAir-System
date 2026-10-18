ALTER TABLE registration_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON registration_preferences FROM anon, authenticated;
GRANT ALL ON registration_preferences TO service_role;
