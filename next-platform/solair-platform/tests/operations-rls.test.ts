import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
test('Operational contact, applicant, incident and SMS tables deny direct browser database access',async()=>{
 const db=new PGlite();
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  for(const file of ['001_core.sql','005_operations.sql','006_operations_supabase.sql','007_registration.sql','008_registration_supabase.sql','009_registration_details.sql','010_registration_details_supabase.sql'])await db.exec(readFileSync(new URL('../backend/migrations/'+file,import.meta.url),'utf8'));
  for(const role of ['anon','authenticated']){
   await db.exec('SET ROLE '+role);
   for(const table of ['contact_preferences','access_requests','device_operation','archived_frames','alarm_incidents','sms_jobs','sms_attempts','sms_cooldowns','sms_budget','registration_preferences','profile_registration','operator_information','vehicle_operators','activity_details'])await assert.rejects(db.query('SELECT * FROM '+table));
   await db.exec('RESET ROLE');
  }
 }finally{await db.close();}
});
