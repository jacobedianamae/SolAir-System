import {randomUUID} from 'node:crypto';
import type {Store} from './db';
import type {Telemetry} from '../packages/telemetry-contract';
import {csvRows} from '../packages/operations';

export const operational = () => process.env.SOLAIR_ENVIRONMENT === 'operational';
export const smsMode = () => process.env.SOLAIR_SMS_MODE || 'disabled';
export const paidEnabled = () => operational() && smsMode() === 'live' && process.env.SOLAIR_SMS_ALLOW_PAID === '1';
const now = () => new Date().toISOString();
export function smsBody(incident: any): string {
  const causes = JSON.parse(incident.causes_json).join(', ') || 'cause unavailable';
  const location = JSON.parse(incident.location_json);
  return `SOLAIR ${incident.vehicle_id}: ${incident.delayed ? 'DELAYED report; ' : ''}alarm reported active (${causes}). ${incident.occurred_at ? 'Device time ' + incident.occurred_at : 'Event time unknown; received ' + incident.received_at}. ${location.latitude == null ? 'GPS unavailable.' : `Last known GPS ${location.latitude},${location.longitude} recorded ${location.measured_at}; fix time/freshness unconfirmed.`} Siren sound not confirmed.`;
}

// Called only inside the authenticated ingestion transaction.
export async function recordIncident(db: Store, t: Telemetry, device: any, received: string, bench: boolean) {
  if (t.source_type !== 'hardware' || !t.alarm_id || !t.event_id) return;
  const id = `${t.device_id}:${t.boot_id}:${t.alarm_id}`;
  const [prior] = await db.query('SELECT * FROM alarm_incidents WHERE id=?', [id]);
  const causes = [...new Set([...(prior?JSON.parse(prior.causes_json):[]),...(t.alarm_causes || []), ...(t.event_type ? [t.event_type] : [])])].sort();
  const eventTime=t.event_timestamp!==undefined?t.event_timestamp:t.device_timestamp;
  const occurred=prior?.alarm_reported ? (!prior.occurred_at||(t.alarm_active&&!eventTime)?null:[prior.occurred_at,eventTime].filter(Boolean).sort()[0]) : (t.alarm_active?eventTime:null);
  const delayed = !occurred || Date.parse(received) - Date.parse(occurred) > 15 * 60000;
  const [location] = await db.query('SELECT latitude,longitude,measured_at FROM gps_records WHERE device_id=? AND mode=? AND measured_at<=? ORDER BY measured_at DESC LIMIT 1', [t.device_id, 'hardware', occurred || received]);
  const incident = {id, org_id:device.org_id, vehicle_id:device.vehicle_id, device_id:t.device_id,
    boot_id:t.boot_id, alarm_id:t.alarm_id, mode:'hardware', causes_json:JSON.stringify(causes),
    occurred_at:occurred, received_at:prior?.received_at||received, time_quality:occurred?'device_utc':'receipt_only',
    location_json:JSON.stringify(t.gps_fix&&eventTime&&t.device_timestamp&&Math.abs(Date.parse(eventTime)-Date.parse(t.device_timestamp))<=1000?{latitude:t.latitude,longitude:t.longitude,measured_at:t.device_timestamp||received,time_quality:t.device_timestamp?'device_utc':'receipt_only'}:location || {}), alarm_reported:t.alarm_active||prior?.alarm_reported?1:0, delayed:delayed?1:0};
  if(prior){
    await db.run('UPDATE alarm_incidents SET causes_json=?,occurred_at=?,time_quality=?,alarm_reported=?,delayed=? WHERE id=?',[incident.causes_json,occurred,incident.time_quality,incident.alarm_reported,incident.delayed,id]);
    await db.run("UPDATE sms_jobs SET body=? WHERE incident_id=? AND status='queued'",[smsBody(incident),id]);
  }else await db.run('INSERT INTO alarm_incidents(id,org_id,vehicle_id,device_id,boot_id,alarm_id,mode,causes_json,occurred_at,received_at,time_quality,location_json,alarm_reported,delayed) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', Object.values(incident));
  // A later inactive cause may arrive before activation. Preserve it, but only
  // a reported active event can create the one set of recipient jobs.
  if(!t.alarm_active||prior?.alarm_reported)return;
  // USB bench and presentation records cannot produce operational SMS.
  if (bench || !operational()) return;
  const [registration] = await db.query('SELECT * FROM device_operation WHERE device_id=? AND commissioned=1', [t.device_id]);
  if (!registration) return;
  // Without assignment history, delayed events go only to the designated operator for review.
  const recipients = await db.query(`SELECT p.id,c.phone_e164 FROM profiles p JOIN contact_preferences c ON c.user_id=p.id WHERE p.org_id=? AND c.sms_consent=1 AND c.phone_verified_at IS NOT NULL AND c.email_verified_at IS NOT NULL AND ((p.id=? AND p.role IN ('operator','admin')) OR (p.role='driver' AND EXISTS(SELECT 1 FROM assignments a WHERE a.driver_id=p.id AND a.vehicle_id=?)))`, [device.org_id, registration.operator_id, delayed ? '' : device.vehicle_id]);
  const seen = new Set<string>();
  for (const person of recipients) {
    if (!person.phone_e164 || seen.has(person.phone_e164)) continue;
    seen.add(person.phone_e164);
    const [cooldown] = await db.query('SELECT sent_at FROM sms_cooldowns WHERE vehicle_id=? AND phone_e164=?', [device.vehicle_id,person.phone_e164]);
    const suppressed = cooldown && Date.parse(received) - Date.parse(cooldown.sent_at) < 300000;
    await db.run('INSERT INTO sms_jobs(id,incident_id,user_id,phone_e164,status,reason,body,next_attempt_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [randomUUID(),id,person.id,person.phone_e164,suppressed?'suppressed':'queued',suppressed?'Five-minute vehicle/recipient cooldown':'',smsBody(incident),received,received,received]);
    if (!suppressed) await db.run('INSERT INTO sms_cooldowns VALUES (?,?,?) ON CONFLICT(vehicle_id,phone_e164) DO UPDATE SET sent_at=excluded.sent_at', [device.vehicle_id,person.phone_e164,received]);
  }
}

export interface SmsProvider {send(phone:string,body:string,jobId?:string):Promise<{status:'accepted'|'failed'|'unknown';id?:string;retryable?:boolean;detail:string}>;}
export class TwilioSms implements SmsProvider {
  async send(phone:string,body:string,jobId?:string) {
    const account=process.env.TWILIO_ACCOUNT_SID,auth=process.env.TWILIO_AUTH_TOKEN,service=process.env.TWILIO_MESSAGING_SERVICE_SID;
    if(!account||!auth||!service) return {status:'failed' as const,detail:'Provider configuration incomplete'};
    try {
      const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(account)}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(account+':'+auth).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:phone,Body:body,MessagingServiceSid:service,StatusCallback:process.env.SOLAIR_PUBLIC_URL+'/api/sms/status?job='+encodeURIComponent(jobId||'')}),signal:AbortSignal.timeout(12000)});
      const data=await response.json();
      if(response.ok&&typeof data.sid==='string') return {status:'accepted' as const,id:data.sid,detail:'Provider accepted; delivery unconfirmed'};
      if(response.status===429) return {status:'failed' as const,retryable:true,detail:'Provider rate limit'};
      return {status:response.status>=500?'unknown' as const:'failed' as const,detail:'Provider rejected or outcome uncertain'};
    } catch {return {status:'unknown' as const,detail:'Submission outcome unknown; reconcile before resending'};}
  }
}

// A durable atomic claim prevents two workers from sending the same queued job.
// Claimed/unknown work is never automatically resent after a crash.
export async function processSms(db:Store,provider:SmsProvider = new TwilioSms(), clock=now()) {
  if(!operational() || !['test','live'].includes(smsMode())) return;
  if(smsMode()==='live'&&!paidEnabled()) return;
  const [pending] = await db.query("SELECT id FROM sms_jobs WHERE status='queued' AND next_attempt_at<=? ORDER BY created_at LIMIT 1",[clock]);
  if(!pending) return;
  const [job]=await db.query("UPDATE sms_jobs SET status='unknown',reason='Claimed; outcome pending reconciliation',attempts=attempts+1,updated_at=? WHERE id=? AND status='queued' RETURNING *",[clock,pending.id]);
  if(!job) return;
  const [access]=await db.query(`SELECT c.*,p.org_id,p.role,i.vehicle_id,i.org_id AS incident_org,d.operator_id,d.commissioned FROM contact_preferences c JOIN profiles p ON p.id=c.user_id JOIN alarm_incidents i ON i.id=? JOIN device_operation d ON d.device_id=i.device_id WHERE c.user_id=?`,[job.incident_id,job.user_id]);
  const [assignment]=await db.query('SELECT driver_id FROM assignments WHERE vehicle_id=?',[access?.vehicle_id || '']);
  if(!access||!access.commissioned||!access.sms_consent||!access.phone_verified_at||!access.email_verified_at||access.phone_e164!==job.phone_e164||access.org_id!==access.incident_org||!((access.operator_id===job.user_id&&['operator','admin'].includes(access.role)) || (access.role==='driver'&&assignment?.driver_id===job.user_id))) {
    await db.run("UPDATE sms_jobs SET status='suppressed',reason='Recipient verification, consent or access changed',updated_at=? WHERE id=?",[clock,job.id]);return;
  }
  if(smsMode()==='test') {
    // Test mode never calls a paid provider or claims actual delivery.
    await db.run("UPDATE sms_jobs SET status='simulated',reason='Dry-run; no SMS transmitted',updated_at=? WHERE id=?",[clock,job.id]);
    await db.run('INSERT INTO sms_attempts VALUES (?,?,?,?,?)',[randomUUID(),job.id,'simulated','Dry-run; no SMS transmitted',clock]);return;
  }
  const allowed=(process.env.SOLAIR_SMS_TEST_RECIPIENTS||'').split(',').map(x=>x.trim());
  if(process.env.SOLAIR_SMS_COMMISSIONING!=='complete'&&!allowed.includes(job.phone_e164)) {
    await db.run("UPDATE sms_jobs SET status='suppressed',reason='Commissioning recipient restriction',updated_at=? WHERE id=?",[clock,job.id]);return;
  }
  const [incident]=await db.query('SELECT * FROM alarm_incidents WHERE id=?',[job.incident_id]);
  const body=smsBody({...incident,delayed:!incident.occurred_at||Date.parse(clock)-Date.parse(incident.occurred_at)>900000});
  await db.run('UPDATE sms_jobs SET body=? WHERE id=?',[body,job.id]);
  const segments=Math.max(1,Math.ceil(body.length/153));
  const limit=Number(process.env.SOLAIR_SMS_DAILY_SEGMENT_LIMIT || 20);
  if(!Number.isInteger(limit)||limit<1||limit>1000) throw new Error('Invalid SMS daily segment limit');
  const day=clock.slice(0,10);
  await db.run('INSERT INTO sms_budget(day,reserved_segments) VALUES (?,0) ON CONFLICT(day) DO NOTHING',[day]);
  const [budget]=await db.query('UPDATE sms_budget SET reserved_segments=reserved_segments+? WHERE day=? AND reserved_segments+?<=? RETURNING day',[segments,day,segments,limit]);
  if(!budget) {await db.run("UPDATE sms_jobs SET status='suppressed',reason='Daily segment budget reached',updated_at=? WHERE id=?",[clock,job.id]);return;}
  const result=await provider.send(job.phone_e164,body,job.id);
  const retry=result.status==='failed'&&result.retryable&&job.attempts<3;
  const status=retry?'queued':result.status;
  await db.run('INSERT INTO sms_attempts VALUES (?,?,?,?,?)',[randomUUID(),job.id,result.status,result.detail,clock]);
  await db.run("UPDATE sms_jobs SET status=?,provider_id=?,reason=?,next_attempt_at=?,updated_at=? WHERE id=? AND status='unknown'",[status,result.id||null,result.detail,new Date(Date.parse(clock)+(job.attempts===1?30000:120000)).toISOString(),clock,job.id]);
}

export const exportCsv = csvRows;

// Retain stable IDs for deduplication while applying the existing location retention policy.
// Called only by the explicit retention command, never during ordinary browsing.
export async function redactOperationalHistory(db:Store,cutoff:string) {
  await db.run("UPDATE alarm_incidents SET location_json='{}' WHERE received_at<?",[cutoff]);
  await db.run("UPDATE sms_jobs SET body='Redacted under retention policy',phone_e164='redacted:'||id,status=CASE WHEN status='queued' THEN 'suppressed' ELSE status END,reason='Contact/message redacted under retention policy' WHERE incident_id IN (SELECT id FROM alarm_incidents WHERE received_at<?)",[cutoff]);
  await db.run('DELETE FROM sms_cooldowns WHERE sent_at<?',[cutoff]);
}
