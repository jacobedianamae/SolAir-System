import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer,type Server} from 'node:http';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {Store} from '../server/db';
import {seed} from '../server/seed';
import {createApp} from '../server/app';
import type {IdentityProvider} from '../server/identity';
let db:Store,server:Server,base:string,cookie:string;let recovered=false;
const users=new Map([['operator@solair.local','operator']]);
const identity:IdentityProvider={name:'supabase',authenticate:async(email,password)=>password==='ProviderOnly!2026'?users.get(email)||null:null,createUser:async(email)=>{const id=randomUUID();users.set(email,id);return id;},requestRecovery:async()=>{},recoverPassword:async()=>{recovered=true;return 'operator';}};
async function req(path:string,method='GET',body?:unknown,authenticated=false){const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json',...(authenticated?{Cookie:cookie}: {})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json(),headers:r.headers};}
before(async()=>{db=new Store(':memory:');await db.migrate();await seed(db);server=createServer(createApp(db,false,identity));await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));base=`http://127.0.0.1:${(server.address()as any).port}`;const login=await req('/login','POST',{email:'operator@solair.local',password:'ProviderOnly!2026'});assert.equal(login.status,200);cookie=login.headers.get('set-cookie')!.split(';')[0];});
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await db.close();});
test('Configured identity provider rejects local password fallback',async()=>{assert.equal((await req('/login','POST',{email:'operator@solair.local',password:'SolairDemo!2026'})).status,401);});
test('Provider identity is bound to a trusted database profile and private session',async()=>{const me=await req('/me','GET',undefined,true);assert.equal(me.body.id,'operator');assert.equal(me.body.role,'operator');assert.equal((await req('/health')).body.auth_provider,'supabase');assert.equal((await req('/login','POST',{email:'unassigned@example.com',password:'ProviderOnly!2026'})).status,401);});
test('Supabase-backed invitation keeps the server-assigned role and does not mirror passwords',async()=>{const invite=await req('/invite','POST',{email:'cloud-driver@example.com',role:'driver'},true);const token=invite.body.invitation_url.split('token=')[1];assert.equal((await req('/register','POST',{token,name:'Cloud fixture',password:'ProviderOnly!2026'})).status,201);const [profile]=await db.query('SELECT * FROM profiles WHERE email=?',['cloud-driver@example.com']);assert.equal(profile.id,users.get(profile.email));assert.equal(profile.role,'driver');assert.equal(profile.password_hash,'supabase-managed');assert.equal((await req('/register','POST',{token,name:'Duplicate',password:'ProviderOnly!2026'})).status,400);});
test('Password recovery revokes shared SOLAIR sessions without claiming email delivery',async()=>{const recovery=await req('/password/reset-request','POST',{email:'operator@solair.local'});assert.equal(recovery.body.accepted,true);assert.match(recovery.body.message,/not independently verified/);assert.equal((await req('/password/recover','POST',{access_token:'software-fixture',refresh_token:'software-fixture',password:'NewPassword!2026'})).status,200);assert.equal(recovered,true);assert.equal((await req('/me','GET',undefined,true)).status,401);});
test('Supabase migration denies direct anonymous/authenticated table access',async()=>{const pg=new PGlite();try{await pg.exec(readFileSync(new URL('../backend/migrations/001_core.sql',import.meta.url),'utf8'));await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE PUBLICATION supabase_realtime;');await pg.exec(readFileSync(new URL('../backend/migrations/002_supabase.sql',import.meta.url),'utf8'));await pg.exec(readFileSync(new URL('../backend/migrations/003_cpe.sql',import.meta.url),'utf8'));await pg.exec(readFileSync(new URL('../backend/migrations/004_cpe_supabase.sql',import.meta.url),'utf8'));const tables=await pg.query<{relrowsecurity:boolean}>('SELECT relrowsecurity FROM pg_class WHERE relname IN (\'profiles\',\'gps_records\',\'sessions\')');assert.ok(tables.rows.every(r=>r.relrowsecurity));for(const role of ['anon','authenticated']){await pg.exec(`SET ROLE ${role}`);await assert.rejects(pg.query('SELECT * FROM profiles'));await assert.rejects(pg.query('SELECT * FROM cpe_samples'));await pg.exec('RESET ROLE');}const publications=await pg.query<{tablename:string}>("SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime'");assert.deepEqual(publications.rows.map(r=>r.tablename).sort(),['help_requests','messages','security_events','telemetry']);}finally{await pg.close();}});


// Provider outcomes are fixtures; no email is sent by this test.
test('Operational signup creates a profile immediately but still requires provider email confirmation',async()=>{
 const old=process.env.SOLAIR_ENVIRONMENT;process.env.SOLAIR_ENVIRONMENT='operational';let verified=false;
 const oldRegister=identity.registerApplicant,oldVerified=identity.emailVerified;
 identity.registerApplicant=async(email)=>{const id=randomUUID();users.set(email,id);return id;};identity.emailVerified=async()=>verified;
 try{
  const email='direct-cloud@example.com',password='ProviderOnly!2026';
  const created=await req('/signup','POST',{name:'TEST FIXTURE Direct',email,password,confirmation:password,phone:'09171234567',sms_consent:false});assert.equal(created.status,201);assert.equal(created.body.email_confirmation_required,true);
  const [profile]=await db.query('SELECT * FROM profiles WHERE email=?',[email]);assert.equal(profile.id,users.get(email));assert.equal(profile.role,'driver');assert.equal(profile.password_hash,'supabase-managed');
  assert.equal((await req('/login','POST',{email,password})).status,403);
  verified=true;const login=await req('/login','POST',{email,password});assert.equal(login.status,200);
  const fleet=await fetch(base+'/api/fleet?mode=hardware',{headers:{Cookie:login.headers.get('set-cookie')!.split(';')[0]}});assert.deepEqual(await fleet.json(),[]);
 }finally{identity.registerApplicant=oldRegister;identity.emailVerified=oldVerified;if(old===undefined)delete process.env.SOLAIR_ENVIRONMENT;else process.env.SOLAIR_ENVIRONMENT=old;}
});
