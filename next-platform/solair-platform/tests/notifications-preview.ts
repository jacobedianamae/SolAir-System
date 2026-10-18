// Self-contained software fixture runner. Never selects a working fleet database.
import {spawn} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/db';
import {seed} from '../server/seed';
const directory=mkdtempSync(join(tmpdir(),'solair-notifications-ui-'));
const database=join(directory,'fixture.sqlite');
delete process.env.DATABASE_URL;
const db=new Store(database);await db.migrate();await seed(db);
const at=new Date().toISOString();
await db.run('INSERT INTO security_events VALUES (?,?,?,?,?,?)',['TEST-FIXTURE-demo-offline','SOL-ET-01','demo','Device offline',at,null]);
await db.run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)',['TEST-FIXTURE-registration','manila','operator','vehicle_created','ET-01',at]);
await db.close();
const base='http://127.0.0.1:15372';
const env={...process.env,PORT:'15372',SOLAIR_DB_PATH:database,SOLAIR_ALLOW_LOCAL_PREVIEW:'1',SOLAIR_BIND_HOST:'127.0.0.1',SOLAIR_INGEST_HOST:'',DATABASE_URL:'',SOLAIR_AUTH_PROVIDER:'',SOLAIR_REALTIME_PROVIDER:''};
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let output='';server.stdout?.on('data',value=>output+=value.toString());server.stderr?.on('data',value=>output+=value.toString());
try{
 let ready=false;
 for(let i=0;i<120;i++){
  try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{/* Owned fixture server is starting. */}
  if(server.exitCode!==null)throw new Error('Fixture preview failed: '+output);
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(!ready)throw new Error('Fixture preview did not become ready');
 const check=spawn(process.execPath,['--import','tsx','tests/notifications-browser.ts'],{env:{...env,TEST_URL:base},windowsHide:true,stdio:'inherit'});
 const code=await new Promise<number|null>((resolve,reject)=>{check.on('error',reject);check.on('exit',resolve);});
 if(code!==0)throw new Error('Notification browser checks failed: '+code);
 console.log('Notification UI verified on isolated seeded demo fixtures; no physical hardware tests.');
}finally{server.kill('SIGTERM');server.stdout?.destroy();server.stderr?.destroy();server.unref();}
