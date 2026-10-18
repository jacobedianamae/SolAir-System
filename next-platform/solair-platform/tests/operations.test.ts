import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer,type Server} from 'node:http';
import {createHmac} from 'node:crypto';
import {Store} from '../server/db';
import {PostgresTestStore} from './postgres-store';
import {seed} from '../server/seed';
import {createApp} from '../server/app';
import {normalizePhilippineMobile,csvRows} from '../packages/operations';
import {telemetrySchema} from '../packages/telemetry-contract';
import {processSms,recordIncident,redactOperationalHistory} from '../server/operations';
let db:Store,server:Server,base:string;
const cookies:Record<string,string>={};
const original={...process.env};
const at='2026-10-18T08:00:00.000Z';
const fixture=(sequence:number,extra:any={})=>telemetrySchema.parse({schema_version:1,device_id:'SOL-ET-01',boot_id:'TEST-FIXTURE-operations',sequence,device_uptime_ms:sequence*2000,firmware_version:'TEST FIXTURE ONLY',device_timestamp:at,source_type:'hardware',transport:'wifi',sensor_health:{},...extra});
async function request(path:string,role='',body?:any,method?:string){const res=await fetch(base+'/api'+path,{method:method||(body===undefined?'GET':'POST'),headers:{Cookie:cookies[role]||'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:res.status,body:res.headers.get('content-type')?.includes('json')?await res.json():await res.text()};}
before(async()=>{
 delete process.env.SOLAIR_ENVIRONMENT;process.env.SOLAIR_SMS_MODE='disabled';
 db=process.env.SOLAIR_TEST_POSTGRES==='1'?new PostgresTestStore():new Store(':memory:');await db.migrate();await seed(db);
 server=createServer(createApp(db));await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`;
 for(const role of ['driver','operator','engineer','admin']){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:role+'@solair.local',password:'SolairDemo!2026'})});cookies[role]=response.headers.get('set-cookie')!.split(';')[0];}
});
after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();for(const key of ['SOLAIR_ENVIRONMENT','SOLAIR_SMS_MODE','SOLAIR_SMS_ALLOW_PAID','SOLAIR_SMS_COMMISSIONING','SOLAIR_SMS_TEST_RECIPIENTS']){if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];}});
test('Philippine numbers normalize consistently and malformed numbers fail; CSV cannot execute formulas',()=>{
 for(const value of ['0917 123 4567','+63 917-123-4567','639171234567'])assert.equal(normalizePhilippineMobile(value),'+639171234567');
 for(const value of ['+14155551234','0917','091712345678','+6309171234567'])assert.throws(()=>normalizePhilippineMobile(value));
 assert.match(csvRows([{value:'=1+1'}]),/'=1\+1/);
});
test('Direct signup creates a usable driver account without requests or fleet access',async()=>{
 const body={name:'TEST FIXTURE Registered',email:'fixture-registered@example.com',password:'FixtureOnly!2026',confirmation:'FixtureOnly!2026',phone:'09171234567',sms_consent:true,vehicle_brand:'NWOW'};
 assert.equal((await request('/signup','',{...body,role:'admin',org_id:'manila',vehicle_id:'ET-01'})).status,400);
 assert.equal((await request('/signup','',{...body,confirmation:'wrong'})).status,400);
 assert.equal((await request('/signup','',body)).status,201);
 const [created]=await db.query('SELECT * FROM profiles WHERE email=?',[body.email]);assert.equal(created.role,'driver');assert.notEqual(created.org_id,'manila');
 assert.equal((await db.query('SELECT vehicle_brand FROM profile_registration WHERE user_id=?',[created.id]))[0].vehicle_brand,'NWOW');
 assert.equal((await db.query('SELECT id FROM access_requests WHERE email=?',[body.email])).length,0);
 const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:body.email,password:body.password})});assert.equal(response.status,200);cookies.registered=response.headers.get('set-cookie')!.split(';')[0];
 assert.deepEqual((await request('/fleet?mode=hardware','registered')).body,[]);
 assert.equal((await request('/incidents/ET-01','registered')).status,403);
 assert.equal((await request('/access-requests','registered')).status,403);
 const contact=(await request('/contact-preferences','registered')).body;assert.equal(contact.phone_e164,'+639171234567');assert.equal(contact.phone_verified_at,null);
 // Duplicate registration cannot change the password or create a second workspace.
 assert.equal((await request('/signup','',body)).status,409);
});
test('Legacy access requests remain admin-only and cannot choose public privileges',async()=>{
 const body={name:'TEST FIXTURE Applicant',email:'fixture-applicant@example.com',password:'FixtureOnly!2026',confirmation:'FixtureOnly!2026',phone:'09171234567',sms_consent:true};
 assert.equal((await request('/access-requests','',{...body,role:'admin',org_id:'manila'})).status,400);
 assert.equal((await request('/access-requests','',body)).status,202);
 assert.equal((await db.query('SELECT * FROM profiles WHERE email=?',[body.email])).length,0);
 assert.equal((await request('/access-requests','operator')).status,403);
 const pending=(await request('/access-requests','admin')).body[0];
 assert.equal((await request('/access-requests/'+pending.id+'/review','admin',{decision:'approved',role:'driver',org_id:'manila'})).status,200);
 const [created]=await db.query('SELECT * FROM profiles WHERE email=?',[body.email]);assert.equal(created.role,'driver');
 const [contact]=await db.query('SELECT * FROM contact_preferences WHERE user_id=?',[created.id]);assert.equal(contact.phone_verified_at,null);assert.equal(contact.email_verified_at,null);
});
test('People directory paginates all accounts for admin, scopes operators and links new users securely',async()=>{
 const [person]=await db.query('SELECT * FROM profiles WHERE email=?',['fixture-registered@example.com']);
 for(let n=0;n<27;n++)await db.run('INSERT INTO profiles(id,org_id,email,name,role,password_hash) VALUES (?,?,?,?,?,?)',['directory-'+n,'other','directory'+n+'@example.com','Directory fixture '+n,'driver','not-a-login']);
 assert.equal((await request('/people')).status,401);
 assert.equal((await request('/people','registered')).status,403);
 const first=(await request('/people?q=Directory&status=driver','admin')).body;assert.equal(first.total,27);assert.equal(first.items.length,25);
 assert.equal((await request('/people?q=Directory&page=2','admin')).body.items.length,2);
 assert.equal((await request('/people?q=Directory','operator')).body.total,0);
 const unassigned=(await request('/people?q=fixture-registered&status=unassigned','admin')).body;assert.equal(unassigned.total,1);assert.equal(unassigned.items[0].id,person.id);
 const body={name:person.name,role:'driver',org_id:'manila',expected_org_id:person.org_id};
 assert.equal((await request('/admin/people/'+person.id,'operator',body,'PATCH')).status,403);
 assert.equal((await request('/admin/people/'+person.id,'admin',{...body,expected_org_id:'wrong'},'PATCH')).status,409);
 assert.equal((await request('/admin/people/'+person.id,'admin',body,'PATCH')).status,200);
 assert.equal((await request('/me','registered')).status,401);
 const login=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:person.email,password:'FixtureOnly!2026'})});assert.equal(login.status,200);
 const cookie=login.headers.get('set-cookie')!.split(';')[0];
 const membership=await (await fetch(base+'/api/me',{headers:{Cookie:cookie}})).json();
 const registration=await (await fetch(base+'/api/registration',{headers:{Cookie:cookie}})).json();
 assert.equal(membership.org_id,'manila');assert.equal(membership.organization_name,'Manila Central TODA');assert.equal(registration.organization,membership.organization_name);
 assert.equal((await db.query('SELECT org_id FROM profiles WHERE id=?',[person.id]))[0].org_id,'manila');
 assert.equal((await db.query('SELECT * FROM assignments WHERE driver_id=?',[person.id])).length,0);
 assert.equal((await request('/admin/people/'+person.id,'admin',{...body,org_id:'other',expected_org_id:'manila'},'PATCH')).status,409);
});
test('Operator signup records intended role without granting fleet management privileges',async()=>{
 const body={name:'TEST FIXTURE Wants operator',email:'wants-operator@example.com',password:'FixtureOnly!2026',confirmation:'FixtureOnly!2026',phone:'09171234567',sms_consent:false,requested_role:'operator'};
 assert.equal((await request('/signup','',body)).status,201);
 const [person]=await db.query('SELECT * FROM profiles WHERE email=?',[body.email]);assert.equal(person.role,'driver');
 assert.equal((await db.query('SELECT requested_role FROM registration_preferences WHERE user_id=?',[person.id]))[0].requested_role,'operator');
 const found=(await request('/people?q=wants-operator','admin')).body.items[0];assert.equal(found.requested_role,'operator');
 assert.equal((await request('/admin/people/'+person.id,'admin',{name:person.name,role:'operator',org_id:'manila',expected_org_id:person.org_id},'PATCH')).status,200);
 assert.equal((await db.query('SELECT role FROM profiles WHERE id=?',[person.id]))[0].role,'operator');
});
test('Registration details expose actual authorized assignments and safe editable marker names',async()=>{
 assert.equal((await request('/registration')).status,401);
 assert.equal((await request('/registration','driver',{vehicle_brand:'OTHER',display_name:'Fixture'},'PATCH')).status,400);
 assert.equal((await request('/registration','driver',{vehicle_brand:'NWOW',display_name:'TEST FIXTURE GPS name'},'PATCH')).status,200);
 const value=(await request('/registration','driver')).body;
 assert.equal(value.vehicle_brand,'NWOW');assert.equal(value.display_name,'TEST FIXTURE GPS name');assert.equal(value.role,'driver');
 assert.equal(value.vehicles[0].id,'ET-01');assert.equal(value.vehicles[0].model,'BEMAC 68VM Passenger');assert.equal(value.vehicles[0].operator_name,null);
 assert.equal((await request('/fleet?mode=hardware','driver')).body[0].driver_display_name,'TEST FIXTURE GPS name');
 assert.equal((await request('/registration','driver',{user_id:'operator',vehicle_brand:'BEMAC',display_name:'Forbidden'},'PATCH')).status,400);
});
test('Operator business information and explicit vehicle operators stay authorized and separate from SMS',async()=>{
 const info={business_name:'TEST FIXTURE Transport',service_area:'Malabon test route',public_phone:'09171234567'};
 assert.equal((await request('/operator-information/operator','driver',info,'PATCH')).status,403);
 assert.equal((await request('/operator-information/operator','operator',info,'PATCH')).status,200);
 assert.equal((await request('/operator-information/operator','driver')).status,403);
 assert.equal((await request('/contact-preferences','operator')).body.phone_e164,'');
 assert.equal((await request('/assign','admin',{vehicle_id:'ET-01',driver_id:'driver',operator_id:'outsider'})).status,403);
 assert.equal((await request('/assign','operator',{vehicle_id:'ET-01',driver_id:'driver',operator_id:'admin'})).status,403);
 await db.run('INSERT INTO device_operation VALUES (?,?,?,?,?)',['SOL-ET-01',1,'admin','TEST FIXTURE old recipient',at]);
 assert.equal((await request('/assign','admin',{vehicle_id:'ET-01',driver_id:'driver',operator_id:'operator'})).status,200);
 assert.equal((await db.query('SELECT commissioned FROM device_operation WHERE device_id=?',['SOL-ET-01']))[0].commissioned,0);
 const vehicle=(await request('/registration','driver')).body.vehicles[0];assert.equal(vehicle.operator_name,'Andrea Reyes');assert.equal(vehicle.business_name,info.business_name);assert.equal(vehicle.public_phone,'+639171234567');
 assert.equal((await request('/vehicles','operator',{id:'NW-TEST',name:'TEST FIXTURE NWOW',brand:'NWOW'})).status,201);
 assert.equal((await db.query('SELECT model FROM vehicles WHERE id=?',['NW-TEST']))[0].model,'NWOW');
});
test('Admin activity includes cross-workspace registrations, assignment snapshots and filterable sign-ins',async()=>{
 assert.equal((await request('/admin/activity','operator')).status,403);
 assert.equal((await request('/admin/activity','driver')).status,403);
 const registrations=(await request('/admin/activity?category=registrations','admin')).body;assert.ok(registrations.items.some((row:any)=>row.action==='account_registered'&&row.person==='TEST FIXTURE Registered'));
 const assignments=(await request('/admin/activity?category=assignments','admin')).body;assert.ok(assignments.items.some((row:any)=>row.description?.includes('Miguel Santos')&&row.description.includes('Andrea Reyes')));
 const value=(await request('/admin/activity','admin')).body;assert.ok(value.items.every((row:any)=>row.action!=='sign_in'));assert.ok(value.items.every((row:any)=>!('target'in row)));
 const signins=(await request('/admin/activity?category=signins','admin')).body;assert.ok(signins.items.length>0);assert.ok(signins.items.every((row:any)=>row.action==='sign_in'));
});
test('Contact changes invalidate verification, SMS consent is independent, disabled verification makes no provider call',async()=>{
 assert.equal((await request('/contact-preferences','driver',{phone:'09171234567',sms_consent:true},'PATCH')).status,200);
 await db.run('UPDATE contact_preferences SET phone_verified_at=?,email_verified_at=? WHERE user_id=?',[at,at,'driver']);
 await request('/contact-preferences','driver',{phone:'09171234568',sms_consent:false},'PATCH');
 const contact=(await request('/contact-preferences','driver')).body;assert.equal(contact.phone_verified_at,null);assert.equal(contact.sms_consent,0);
 assert.equal((await request('/contact-preferences/verify','driver',{})).status,503);
});
test('CPE evidence cannot cross device, source or organization; driver cannot save bench results',async()=>{
 const session=(await request('/bench/sessions?mode=hardware','engineer',{device_id:'SOL-ET-01'})).body.id;
 const result={session_id:session,test:'TEST FIXTURE evidence binding',result:'NOT TESTED',measurements:'',notes:'Software only',evidence:'',firmware:'TEST FIXTURE',device_id:'SOL-ET-02',mode:'hardware'};
 assert.equal((await request('/bench/results','engineer',result)).status,403);
 assert.equal((await request('/bench/results','engineer',{...result,device_id:'SOL-ET-01',mode:'demo'})).status,403);
 assert.equal((await request('/bench/results','driver',{...result,device_id:'SOL-ET-01'})).status,403);
 assert.equal((await request('/bench/results','engineer',{...result,device_id:'SOL-ET-01'})).status,201);
});
test('Unseen delayed v1 event persists once without replacing newest state; exact durable acknowledgment returned',async()=>{
 const send=async(frame:any)=>{const res=await fetch(base+'/api/ingest',{method:'POST',headers:{Cookie:cookies.engineer,'X-Bench-Transport':'usb','Content-Type':'application/json'},body:JSON.stringify({...frame,transport:'usb'})});return {status:res.status,data:await res.json()};};
 assert.equal((await send(fixture(10))).status,201);
 const delayed=fixture(9,{event_id:'delayed-lid',event_type:'lid',alarm_active:true,alarm_id:'fixture-alarm',alarm_causes:['lid']});
 const accepted=await send(delayed);assert.equal(accepted.status,201);assert.equal(accepted.data.ack.persisted,true);assert.equal(accepted.data.ack.sequence,9);
 assert.equal((await send(delayed)).data.duplicate,true);
 assert.equal((await request('/fleet?mode=hardware','driver')).body[0].telemetry.sequence,10);
 assert.equal((await db.query("SELECT id FROM security_events WHERE type='lid'")).length,1);
 assert.equal((await db.query('SELECT * FROM sms_jobs')).length,0);
});
test('Only admin can commission SMS devices; responsible operator must be in the authorized TODA',async()=>{
 const body={commissioned:true,operator_id:'operator',evidence:'TEST FIXTURE ONLY, no physical commissioning'};
 assert.equal((await request('/device-operation/SOL-ET-01','operator',body)).status,403);
 assert.equal((await request('/device-operation/SOL-ET-01','engineer',body)).status,403);
 assert.equal((await request('/device-operation/SOL-ET-01','admin',{...body,operator_id:'outsider'})).status,400);
 assert.equal((await request('/device-operation/SOL-ET-01','admin',body)).status,200);
});
test('Demo/bench/repeated alarms cannot send SMS; simultaneous causes share one incident',async()=>{
 await db.run('DELETE FROM sms_jobs');await db.run('DELETE FROM alarm_incidents');
 for(const [id,number] of [['driver','+639171234567'],['operator','+639171234568']])await db.run('INSERT INTO contact_preferences VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET phone_e164=excluded.phone_e164,phone_verified_at=excluded.phone_verified_at,email_verified_at=excluded.email_verified_at,sms_consent=1',[id,number,at,at,1,at,at]);
 const device={org_id:'manila',vehicle_id:'ET-01'};
 const frame=fixture(20,{event_id:'active',event_type:'lid',alarm_active:true,alarm_id:'activation-20',alarm_causes:['lid']});
 process.env.SOLAIR_ENVIRONMENT='operational';process.env.SOLAIR_SMS_MODE='test';
 await recordIncident(db,{...frame,source_type:'demo'},device,at,false);assert.equal((await db.query('SELECT * FROM alarm_incidents')).length,0);
 await recordIncident(db,{...frame,alarm_id:'usb-only'},device,at,true);assert.equal((await db.query('SELECT * FROM sms_jobs')).length,0);
 await recordIncident(db,frame,device,at,false);
 await recordIncident(db,fixture(21,{...frame,event_id:'mount',event_type:'mount',alarm_causes:['lid','mount']}),device,at,false);
 assert.equal((await db.query('SELECT * FROM sms_jobs')).length,2);
 const [incident]=await db.query('SELECT * FROM alarm_incidents WHERE alarm_id=?',['activation-20']);assert.deepEqual(JSON.parse(incident.causes_json),['lid','mount']);
 let sends=0;await processSms(db,{send:async()=>{sends++;return {status:'accepted',detail:'fixture'};}},at);
 assert.equal(sends,0);assert.equal((await db.query("SELECT * FROM sms_jobs WHERE status='simulated'")).length,1);
 await recordIncident(db,fixture(22,{...frame,alarm_id:'activation-22',event_id:'another'}),device,at,false);
 assert.equal((await db.query("SELECT * FROM sms_jobs WHERE status='suppressed'")).length,2);
 assert.equal((await request('/fleet?mode=demo','operator')).status,403);
 assert.equal((await request('/incidents/ET-02','driver')).status,403);
 delete process.env.SOLAIR_ENVIRONMENT;process.env.SOLAIR_SMS_MODE='disabled';
});
test('Worker rechecks consent and permissions; disabled/live-without-approval never contacts provider',async()=>{
 process.env.SOLAIR_ENVIRONMENT='operational';process.env.SOLAIR_SMS_MODE='live';delete process.env.SOLAIR_SMS_ALLOW_PAID;
 let sends=0;const provider={send:async()=>{sends++;return {status:'accepted' as const,detail:'fixture'};}};
 await processSms(db,provider,at);assert.equal(sends,0);
 process.env.SOLAIR_SMS_MODE='test';await db.run("UPDATE contact_preferences SET sms_consent=0 WHERE user_id='operator'");
 await processSms(db,provider,at);assert.equal(sends,0);
 assert.ok((await db.query("SELECT * FROM sms_jobs WHERE reason='Recipient verification, consent or access changed'")).length);
 delete process.env.SOLAIR_ENVIRONMENT;process.env.SOLAIR_SMS_MODE='disabled';
});
test('Accepted and ambiguous provider outcomes are never blindly resent; safe retries stop after three attempts',async()=>{
 process.env.SOLAIR_ENVIRONMENT='operational';process.env.SOLAIR_SMS_MODE='live';process.env.SOLAIR_SMS_ALLOW_PAID='1';process.env.SOLAIR_SMS_COMMISSIONING='complete';
 await db.run('UPDATE contact_preferences SET sms_consent=1');
 const clock='2026-10-18T09:00:00.000Z';
 await recordIncident(db,fixture(50,{device_timestamp:clock,event_id:'worker-outcomes',event_type:'lid',alarm_id:'outcomes',alarm_active:true}),{org_id:'manila',vehicle_id:'ET-01'},clock,false);
 let sent=0;
 const accepted={send:async()=>{sent++;return {status:'accepted' as const,id:'TEST-FIXTURE-PROVIDER-ID',detail:'Fixture accepted, no actual SMS'};}};
 await processSms(db,accepted,clock);assert.equal(sent,1);
 const uncertain={send:async()=>{sent++;return {status:'unknown' as const,detail:'Fixture network timeout'};}};
 await processSms(db,uncertain,clock);assert.equal(sent,2);
 await processSms(db,accepted,clock);assert.equal(sent,2);
 assert.equal((await db.query("SELECT * FROM sms_jobs WHERE status='unknown'")).length,1);
 assert.equal((await db.query("SELECT * FROM sms_jobs WHERE status='accepted'")).length,1);
 const later='2026-10-18T10:00:00.000Z';
 // One selected recipient for deterministic retry checks.
 await db.run("UPDATE contact_preferences SET sms_consent=0 WHERE user_id='driver'");
 await recordIncident(db,fixture(51,{device_timestamp:later,event_id:'worker-retry',event_type:'lid',alarm_id:'retry',alarm_active:true}),{org_id:'manila',vehicle_id:'ET-01'},later,false);
 const retry={send:async()=>({status:'failed' as const,retryable:true,detail:'Fixture explicit rate rejection'})};
 await processSms(db,retry,later);await processSms(db,retry,'2026-10-18T10:00:31.000Z');await processSms(db,retry,'2026-10-18T10:02:32.000Z');
 const [job]=await db.query("SELECT j.* FROM sms_jobs j JOIN alarm_incidents i ON i.id=j.incident_id WHERE i.alarm_id='retry'");assert.equal(job.attempts,3);assert.equal(job.status,'failed');
 delete process.env.SOLAIR_ENVIRONMENT;process.env.SOLAIR_SMS_MODE='disabled';delete process.env.SOLAIR_SMS_ALLOW_PAID;delete process.env.SOLAIR_SMS_COMMISSIONING;
});
test('Delivery callbacks require authentic signatures and cannot downgrade delivered state',async()=>{
 process.env.SOLAIR_ENVIRONMENT='operational';process.env.SOLAIR_SMS_MODE='live';process.env.SOLAIR_SMS_ALLOW_PAID='1';
 const keys=['TWILIO_AUTH_TOKEN','TWILIO_ACCOUNT_SID','SOLAIR_PUBLIC_URL'];const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.TWILIO_AUTH_TOKEN='TEST-FIXTURE-NOT-A-PROVIDER-SECRET';process.env.TWILIO_ACCOUNT_SID='TEST-FIXTURE-ACCOUNT';process.env.SOLAIR_PUBLIC_URL='https://fixture.invalid';
 try{
  const [job]=await db.query("SELECT * FROM sms_jobs WHERE status='accepted'");
  const path='/api/sms/status?job='+encodeURIComponent(job.id);
  async function callback(status:string,signed:boolean){
   const body={AccountSid:'TEST-FIXTURE-ACCOUNT',MessageSid:'TEST-FIXTURE-PROVIDER-ID',MessageStatus:status};
   const text='https://fixture.invalid'+path+Object.keys(body).sort().map(k=>k+body[k as keyof typeof body]).join('');
   const signature=signed?createHmac('sha1',process.env.TWILIO_AUTH_TOKEN!).update(text).digest('base64'):'forged';
   return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','X-Twilio-Signature':signature},body:new URLSearchParams(body)});
  }
  assert.equal((await callback('delivered',false)).status,403);
  assert.equal((await callback('delivered',true)).status,204);
  assert.equal((await callback('sent',true)).status,204);
  assert.equal((await db.query('SELECT status FROM sms_jobs WHERE id=?',[job.id]))[0].status,'delivered');
 }finally{for(const key of keys){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key];}delete process.env.SOLAIR_ENVIRONMENT;process.env.SOLAIR_SMS_MODE='disabled';delete process.env.SOLAIR_SMS_ALLOW_PAID;}
});
test('An inactive cause arriving before activation is preserved and coalesced without premature SMS',async()=>{
 const device={org_id:'manila',vehicle_id:'ET-01'};
 await recordIncident(db,fixture(80,{event_id:'late-mount',event_type:'mount',alarm_id:'reverse-order',alarm_active:false,alarm_causes:['mount']}),device,at,false);
 const [inactive]=await db.query("SELECT * FROM alarm_incidents WHERE alarm_id='reverse-order'");assert.equal(inactive.alarm_reported,0);
 await recordIncident(db,fixture(79,{event_id:'early-lid',event_type:'lid',alarm_id:'reverse-order',alarm_active:true,alarm_causes:['lid']}),device,at,false);
 const [active]=await db.query("SELECT * FROM alarm_incidents WHERE alarm_id='reverse-order'");assert.equal(active.alarm_reported,1);assert.deepEqual(JSON.parse(active.causes_json),['lid','mount']);
});
test('Retention removes incident location/message/contact details but preserves deduplication identities',async()=>{
 const before=(await db.query('SELECT id FROM alarm_incidents')).length;
 await redactOperationalHistory(db,'2026-10-19T00:00:00.000Z');
 const rows=await db.query('SELECT * FROM alarm_incidents');assert.equal(rows.length,before);assert.ok(rows.every(row=>row.location_json==='{}'));
 const jobs=await db.query('SELECT * FROM sms_jobs');assert.ok(jobs.every(job=>job.phone_e164.startsWith('redacted:')&&job.body==='Redacted under retention policy'));
});
test('Later clock synchronization does not invent the UTC time of an earlier unknown alarm activation',async()=>{
 const device={org_id:'manila',vehicle_id:'ET-01'};
 await recordIncident(db,fixture(90,{device_timestamp:null,event_id:'unsynchronized-lid',event_type:'lid',alarm_id:'unknown-onset',alarm_active:true}),device,at,false);
 await recordIncident(db,fixture(91,{event_id:'synchronized-mount',event_type:'mount',alarm_id:'unknown-onset',alarm_active:true}),device,at,false);
 const [incident]=await db.query("SELECT * FROM alarm_incidents WHERE alarm_id='unknown-onset'");assert.equal(incident.occurred_at,null);assert.equal(incident.time_quality,'receipt_only');
 await recordIncident(db,fixture(92,{device_timestamp:at,event_timestamp:null,event_uptime_ms:1000,event_id:'captured-later',event_type:'lid',alarm_id:'unknown-event-known-capture',alarm_active:true}),device,at,false);
 const [captured]=await db.query("SELECT * FROM alarm_incidents WHERE alarm_id='unknown-event-known-capture'");assert.equal(captured.occurred_at,null);
});
