// Local presentation/bench launcher. Paid services and cloud credentials are not used.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync} from 'node:fs';
import {URL,fileURLToPath} from 'node:url';
import process from 'node:process';
import console from 'node:console';
const root=fileURLToPath(new URL('../',import.meta.url));
if(!existsSync(new URL('../data/solair.db',import.meta.url)))throw new Error('Combined database missing. Restore the documented private backup before starting.');
const redirect=createServer((req,res)=>{
 if(req.url==='/sw.js'){
  res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});
  return res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.registration.unregister()));");
 }
 const path=req.url?.startsWith('/')&&!req.url.startsWith('//')?req.url:'/';
 res.writeHead(307,{Location:'http://localhost:3000'+path,'Cache-Control':'no-store'});res.end();
});
let child;
redirect.on('error',()=>{console.error('Port 3001 is unavailable; no unrelated process was stopped.');child?.kill('SIGTERM');process.exitCode=1;});
redirect.listen(3001,'127.0.0.1',()=>{
 child=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{cwd:root,stdio:'inherit',env:{...process.env,NODE_ENV:'production',PORT:'3000',SOLAIR_BIND_HOST:'127.0.0.1',SOLAIR_DB_PATH:'data/solair.db',DATABASE_URL:'',SOLAIR_ENVIRONMENT:'demo',SOLAIR_SMS_MODE:'disabled',SOLAIR_SMS_ALLOW_PAID:'0',SOLAIR_ALLOW_LOCAL_PREVIEW:'1',SOLAIR_AUTH_PROVIDER:'local',SOLAIR_REALTIME_PROVIDER:'local',SOLAIR_INGEST_HOST:'',SOLAIR_PUBLIC_URL:'http://localhost:3000'}});
 child.on('error',()=>{console.error('Combined application could not start.');redirect.close();process.exitCode=1;});
 child.on('exit',code=>{redirect.close();process.exitCode=code??1;});
});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{redirect.close();child?.kill(signal);});
