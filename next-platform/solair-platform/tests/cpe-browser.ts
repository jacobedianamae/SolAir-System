// Built-app UI acceptance, disposable TEST FIXTURE SQLite only; no hardware or working accounts.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {Store} from '../server/db';
import {seed} from '../server/seed';
const dir=mkdtempSync(join(tmpdir(),'solair-cpe-ui-')),dbPath=join(dir,'fixture.sqlite');
delete process.env.DATABASE_URL; // This test must never select a configured external database.
const db=new Store(dbPath);await db.migrate();await seed(db);await db.close();
const base='http://127.0.0.1:15371';
const child=spawn(process.execPath,['--import','tsx','server/index.ts','--production'],{cwd:process.cwd(),env:{...process.env,PORT:'15371',SOLAIR_DB_PATH:dbPath,SOLAIR_ALLOW_LOCAL_PREVIEW:'1',SOLAIR_BIND_HOST:'127.0.0.1',SOLAIR_INGEST_HOST:'',DATABASE_URL:'',SOLAIR_AUTH_PROVIDER:'',SOLAIR_REALTIME_PROVIDER:''},stdio:['ignore','pipe','pipe'],windowsHide:true});
let output='';child.stdout?.on('data',b=>output+=b.toString());child.stderr?.on('data',b=>output+=b.toString());
const results:string[]=[];let browser:Awaited<ReturnType<typeof chromium.launch>>|undefined;
try{
 for(let i=0;i<120;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{/* Waiting for the owned fixture server. */}if(child.exitCode!==null)throw new Error('Fixture server failed: '+output);await new Promise(r=>setTimeout(r,500));}
 browser=await chromium.launch({headless:true,...(process.env.SOLAIR_TEST_CHROMIUM?{executablePath:process.env.SOLAIR_TEST_CHROMIUM}:{})});
 const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.getByLabel('Email address').fill('engineer@solair.local');await page.getByLabel('Password',{exact:true}).fill('SolairDemo!2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();
 if(await page.getByLabel('Data mode').inputValue()!=='hardware')await page.getByLabel('Data mode').selectOption('hardware');
 await page.getByRole('button',{name:'CPE Lab',exact:false}).click();await page.getByRole('heading',{name:'From breadboard to road.'}).waitFor();
 try {await page.getByText('No accepted CPE v2 measurements in the latest 100 records.').waitFor();}catch(e){console.log('Browser errors',errors);console.log((await page.locator('body').innerText()).slice(-6000));throw e;}results.push('Empty real-mode CPE is unavailable, no invented sensor history');
 const payload={schema_version:2,device_id:'SOL-ET-01',firmware_version:'TEST FIXTURE cpe-browser',boot_id:'TEST-FIXTURE-ui-boot',sequence:1,device_uptime_ms:2000,device_timestamp:null,source_type:'hardware',transport:'usb',sensor_health:{mpu6050:'ok',pzem017:'ok',lte:'absent'},accelerometer:[0,0,9.81],gyroscope:[0,0,0],lid_state:'secure',mount_state:'secure',cpe:{historical:false,mpu_raw:[0,0,8192,0,0,0,0],meter_source:'bench_supply',load_mode:'bench_resistor',pzem:{quality:'ok',voltage_v:12.1,current_a:0.2,power_w:2.4,energy_wh:7,alarm_high:false,alarm_low:false},acs:{quality:'uncalibrated',current_a:null,adc_mv:1250,zero_v:2.5,sensitivity_v_per_a:0.04},lte:{quality:'unavailable',at_detected:false,registered:false,attached:false,rssi:null,uplink_commissioned:false},gps:{quality:'unavailable',hdop:null,checksum_failures:0,software_uart_overflows:0},alarm:{commanded:false,output_level:null,feedback:null,reason:null,duration_ms:5000},queue_dropped:0}};
 const accepted=await page.evaluate(async data=>(await fetch('/api/ingest',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Bench-Transport':'usb'},body:JSON.stringify(data)})).status,payload);assert.equal(accepted,201);
 await page.getByRole('button',{name:'Refresh network telemetry'}).click();await page.getByText('TEST FIXTURE cpe-browser',{exact:false}).first().waitFor();
 await page.getByText('12.1 V',{exact:true}).waitFor();results.push('Authenticated fixture populates exact PZEM readings and TEST FIXTURE firmware provenance');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Export CPE CSV (up to 5,000 rows)'}).click()]);mkdirSync('docs/cpe-evidence',{recursive:true});await download.saveAs('docs/cpe-evidence/TEST-FIXTURE-cpe.csv');results.push('Authenticated CPE CSV downloads');
 await page.getByText('CPE measurement history',{exact:true}).waitFor();await page.getByRole('cell',{name:'bench_resistor',exact:true}).waitFor({timeout:15000});results.push('PZEM history preserves bench_resistor mode');
 await page.screenshot({path:'docs/cpe-evidence/TEST-FIXTURE-lab-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert.equal(overflow,false);await page.screenshot({path:'docs/cpe-evidence/TEST-FIXTURE-lab-mobile.png',fullPage:true});results.push('390px CPE Lab has no page horizontal overflow');
 await page.setViewportSize({width:1440,height:1050});await page.getByRole('button',{name:'Log out',exact:true}).click();await page.getByLabel('Email address').fill('driver@solair.local');await page.getByLabel('Password',{exact:true}).fill('SolairDemo!2026');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('heading',{name:'Ready for the road, Miguel.'}).waitFor();await page.getByRole('button',{name:'Energy',exact:true}).first().click();await page.getByRole('heading',{name:'MPPT output & CPE channels'}).waitFor();results.push('Driver Energy uses the same accepted device CPE channels');
 assert.deepEqual(errors,[]);results.push('No browser runtime errors');
 writeFileSync('docs/cpe-evidence/browser-results.json',JSON.stringify({provenance:'TEST FIXTURE ONLY',results,fixtureDatabase:dbPath,physicalTests:'NOT RUN'},null,2));console.log(JSON.stringify(results));
}finally{child.kill('SIGTERM');child.stdout?.destroy();child.stderr?.destroy();child.unref();await browser?.close();}


