// Run the existing acceptance scripts without changing historical evidence or live data.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../server/db';
import {seed} from '../server/seed';
const port=15374,probe=createServer();await new Promise<void>((resolve,reject)=>{probe.on('error',reject);probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve()));});
delete process.env.DATABASE_URL;
const database=join(mkdtempSync(join(tmpdir(),'solair-regressions-')),'fixture.sqlite');
const db=new Store(database);await db.migrate();await seed(db);await db.close();
const base=`http://127.0.0.1:${port}`,output='test-results/regression-preview';mkdirSync(output+'/screenshots',{recursive:true});
const env={...process.env,PORT:String(port),SOLAIR_DB_PATH:database,DATABASE_URL:'',SOLAIR_ENVIRONMENT:'bench',SOLAIR_SMS_MODE:'disabled',SOLAIR_SMS_ALLOW_PAID:'',SOLAIR_AUTH_PROVIDER:'',SOLAIR_REALTIME_PROVIDER:'',SOLAIR_ALLOW_LOCAL_PREVIEW:'1',SOLAIR_BIND_HOST:'127.0.0.1',SOLAIR_INGEST_HOST:'',TEST_URL:base};
const server=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let logs='';server.stdout?.on('data',x=>logs+=x.toString());server.stderr?.on('data',x=>logs+=x.toString());
try{
 let ready=false;for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{/* Owned server startup. */}if(server.exitCode!==null)throw new Error(logs);await new Promise(r=>setTimeout(r,500));}if(!ready)throw new Error('Fixture startup timeout');
 const requested=process.argv.slice(2),suites=requested.length?requested:['account-browser','map-browser','browser','pwa'];
 for(const suite of suites){
  if(!['account-browser','map-browser','browser','pwa'].includes(suite))throw new Error('Unsupported suite');
  let source=readFileSync('tests/'+suite+'.ts','utf8').replaceAll('docs/screenshots',output+'/screenshots').replaceAll('docs/browser-results.json',output+'/browser-results.json').replaceAll('docs/pwa-results.json',output+'/pwa-results.json').replace('const base = "http://127.0.0.1:4173";',`const base = ${JSON.stringify(base)};`);
  if(suite==='browser')source=source.replace('  const p = await context.newPage();',`  await context.route('https://tile.openstreetmap.org/**',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#d9e9e5"/></svg>'}));\n  const p = await context.newPage();`);
  const file=output+'/'+suite+'.ts';writeFileSync(file,source);
  const child=spawn(process.execPath,['--import','tsx',file],{env,windowsHide:true,stdio:'inherit'});
  const code=await new Promise<number|null>((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});if(code!==0)throw new Error(suite+' failed: '+code);
 }
}finally{server.kill('SIGTERM');server.stdout?.destroy();server.stderr?.destroy();server.unref();}
