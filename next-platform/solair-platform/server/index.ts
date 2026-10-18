import './env';
import {createServer} from 'node:http';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import next from 'next';
import {Store} from './db';
import {createApp} from './app';
import {seed} from './seed';
import {sweepOffline} from './health';
import {identityProvider} from './identity';
import {startSupabaseRealtime} from './supabase-realtime';
import {deviceOnlyListener,privateIPv4} from './ingress';
import {operational,paidEnabled,processSms} from './operations';
const production=process.argv.includes('--production');
if(production&&!process.env.DATABASE_URL&&process.env.SOLAIR_ALLOW_LOCAL_PREVIEW!=='1')throw new Error('Production requires DATABASE_URL. Local build QA requires SOLAIR_ALLOW_LOCAL_PREVIEW=1.');
if(production&&process.env.SOLAIR_ALLOW_LOCAL_PREVIEW!=='1'&&(process.env.SOLAIR_AUTH_PROVIDER!=='supabase'||process.env.SOLAIR_REALTIME_PROVIDER!=='supabase'))throw new Error('Railway deployment requires SOLAIR_AUTH_PROVIDER=supabase and SOLAIR_REALTIME_PROVIDER=supabase.');
if(operational()&&(!production||!process.env.DATABASE_URL||process.env.SOLAIR_AUTH_PROVIDER!=='supabase'))throw new Error('Operational mode requires production, PostgreSQL and Supabase identity; demo seeding is forbidden');
const db=new Store();await db.migrate();if(!operational()&&!production&&!process.env.DATABASE_URL)await seed(db);
if(paidEnabled()&&['TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_MESSAGING_SERVICE_SID','TWILIO_VERIFY_SERVICE_SID'].some(key=>!process.env[key]))throw new Error('Live SMS approval requires complete server-only provider configuration');
if(operational()){
 if(!process.env.SOLAIR_PUBLIC_URL?.startsWith('https://'))throw new Error('Operational mode needs a public HTTPS origin');
 if((await db.query("SELECT id FROM telemetry WHERE mode='demo' LIMIT 1")).length)throw new Error('Operational mode refuses a database containing demo telemetry; use a separate database');
}
const app=createApp(db,production,identityProvider());
const stopRealtime=startSupabaseRealtime(db,app.locals.notify,state=>{app.locals.realtimeStatus=state;});
let smsRunning=false;const smsTimer=setInterval(()=>{if(smsRunning)return;smsRunning=true;void processSms(db).catch(()=>console.error('SMS worker action failed; inspect incident delivery status')).finally(()=>{smsRunning=false;});},2000);smsTimer.unref();
const healthTimer=setInterval(()=>sweepOffline(db,app.locals.notify).catch(()=>console.error('Device health sweep failed')),30000);healthTimer.unref();
const port=Number(process.env.PORT)||3000,hostname=process.env.SOLAIR_BIND_HOST||(production?'0.0.0.0':'127.0.0.1');
const web=next({dev:!production,hostname,port});await web.prepare();
app.get('/sw.js',(_req,res)=>res.type('application/javascript').set('Cache-Control','no-cache').send(readFileSync(production?'.next/solair-sw.js':'public/sw.js','utf8')));
app.use((req,res,proceed)=>{
 if(production){const nonce=randomBytes(16).toString('base64');const csp=`default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://tile.openstreetmap.org; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`;
  req.headers['content-security-policy']=csp;req.headers['x-nonce']=nonce;res.setHeader('Content-Security-Policy',csp);
 }
 proceed();
});
const handle=web.getRequestHandler();app.use((req,res)=>{void handle(req,res);});
const server=createServer(app);server.on('upgrade',web.getUpgradeHandler());
const ingestHost=process.env.SOLAIR_INGEST_HOST;
if(operational()&&ingestHost)throw new Error('Operational mode requires HTTPS device ingestion; keep the private HTTP listener in a separate bench environment');
if(ingestHost&&!privateIPv4(ingestHost))throw new Error('SOLAIR_INGEST_HOST must be this PC actual private IPv4');
const ingress=ingestHost?deviceOnlyListener(app):null;
if(ingress){ingress.on('error',e=>{console.error('Device ingress failed:',(e as NodeJS.ErrnoException).code);void close();});ingress.listen(3002,ingestHost,()=>console.log('Private device-only ingestion enabled on port 3002 /api/ingest'));}
server.listen(port,hostname,()=>console.log(`SOLAIR Next.js running at http://localhost:${port} (${production?'production':'local development'})`));
let closing=false;async function close(){if(closing)return;closing=true;clearInterval(healthTimer);clearInterval(smsTimer);ingress?.closeAllConnections();ingress?.close();server.closeAllConnections();server.close();await stopRealtime();await db.close();await web.close();process.exit(0);}
process.on('SIGINT',()=>void close());process.on('SIGTERM',()=>void close());
