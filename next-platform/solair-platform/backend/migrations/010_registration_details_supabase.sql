DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['profile_registration','operator_information','vehicle_operators','activity_details'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated',t);
 END LOOP;
END $$;
