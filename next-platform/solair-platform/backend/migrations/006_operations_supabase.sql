DO $$
DECLARE t TEXT;
BEGIN
 FOREACH t IN ARRAY ARRAY['contact_preferences','access_requests','device_operation','archived_frames','alarm_incidents','sms_jobs','sms_attempts','sms_cooldowns','sms_budget'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',t);
 END LOOP;
END $$;
