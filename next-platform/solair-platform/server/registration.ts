import type {Express,RequestHandler} from 'express';
import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {Store} from './db';
import type {User} from './auth';
import {normalizePhilippineMobile} from '../packages/operations';
export function registrationRoutes(app:Express,db:Store,auth:RequestHandler){
 app.get('/api/registration',auth,async(req:any,res)=>{
  const u=req.user as User;
  const [profile]=await db.query('SELECT p.name,p.role,o.name AS organization,r.vehicle_brand,r.display_name,rp.requested_role FROM profiles p JOIN organizations o ON o.id=p.org_id LEFT JOIN profile_registration r ON r.user_id=p.id LEFT JOIN registration_preferences rp ON rp.user_id=p.id WHERE p.id=?',[u.id]);
  const vehicles=await db.query("SELECT v.id,v.name,v.model,p.name AS operator_name,i.business_name,i.public_phone,i.service_area FROM vehicles v LEFT JOIN assignments a ON a.vehicle_id=v.id LEFT JOIN vehicle_operators vo ON vo.vehicle_id=v.id LEFT JOIN profiles p ON p.id=vo.operator_id AND p.org_id=v.org_id AND p.role IN ('operator','admin') LEFT JOIN operator_information i ON i.user_id=p.id WHERE v.org_id=? AND a.driver_id=? ORDER BY v.id",[u.org_id,u.id]);
  res.json({...profile,vehicles});
 });
 app.patch('/api/registration',auth,async(req:any,res)=>{
  const u=req.user as User,b=z.object({vehicle_brand:z.enum(['BEMAC','NWOW']).nullable(),display_name:z.string().trim().min(1).max(60)}).strict().parse(req.body);
  await db.transaction(async tx=>{
   await tx.run('INSERT INTO profile_registration VALUES (?,?,?) ON CONFLICT(user_id) DO UPDATE SET vehicle_brand=excluded.vehicle_brand,display_name=excluded.display_name',[u.id,b.vehicle_brand,b.display_name]);
   await tx.run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)',[randomUUID(),u.org_id,u.id,'registration_details_updated',u.id,new Date().toISOString()]);
  });res.json({ok:true,message:'Registration details saved. Vehicle assignments are unchanged.'});
 });
 app.get('/api/operator-information/:id',auth,async(req:any,res)=>{
  const u=req.user as User,[person]=await db.query('SELECT p.id,p.org_id,p.role,r.requested_role FROM profiles p LEFT JOIN registration_preferences r ON r.user_id=p.id WHERE p.id=?',[req.params.id]);
  if(!person||(u.id!==person.id&&u.role!=='admin'))return res.sendStatus(403);
  if(person.role!=='operator'&&person.role!=='admin'&&person.requested_role!=='operator')return res.status(400).json({error:'This account is not an operator account'});
  const [value]=await db.query('SELECT business_name,service_area,public_phone FROM operator_information WHERE user_id=?',[person.id]);
  res.json(value||{business_name:'',service_area:'',public_phone:''});
 });
 app.patch('/api/operator-information/:id',auth,async(req:any,res)=>{
  const u=req.user as User,[person]=await db.query('SELECT p.id,p.role,r.requested_role FROM profiles p LEFT JOIN registration_preferences r ON r.user_id=p.id WHERE p.id=?',[req.params.id]);
  if(!person||(u.id!==person.id&&u.role!=='admin')||!['operator','admin'].includes(person.role)&&person.requested_role!=='operator')return res.sendStatus(403);
  const b=z.object({business_name:z.string().trim().max(100),service_area:z.string().trim().max(160),public_phone:z.string().trim().max(40)}).strict().parse(req.body);
  let phone='';try{phone=b.public_phone?normalizePhilippineMobile(b.public_phone):'';}catch{return res.status(400).json({error:'Use 09XX XXX XXXX or +63 9XX XXX XXXX for the shared contact number'});}
  await db.transaction(async tx=>{
   await tx.run('INSERT INTO operator_information VALUES (?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET business_name=excluded.business_name,service_area=excluded.service_area,public_phone=excluded.public_phone',[person.id,b.business_name,b.service_area,phone]);
   await tx.run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)',[randomUUID(),u.org_id,u.id,'operator_information_updated',person.id,new Date().toISOString()]);
  });res.json({ok:true,message:'Operator information saved. This shared contact number does not change verified SMS contacts.'});
 });
 app.get('/api/admin/activity',auth,async(req:any,res)=>{
  if(req.user.role!=='admin')return res.sendStatus(403);
  const b=z.object({category:z.enum(['all','registrations','assignments','accounts','devices','security','signins']).default('all'),q:z.string().max(100).default(''),page:z.coerce.number().int().min(1).max(100000).default(1)}).parse(req.query);
  const groups:Record<string,string[]>={registrations:['account_registered','register','registration_details_updated'],assignments:['vehicle_assigned','vehicle_created','account_membership_updated'],accounts:['account_updated','operator_information_updated','invite_created','legacy_request_archived'],devices:['device_commissioning_changed','device_credential_rotated','calibration_recorded'],security:['alert_ack','help_submitted','help_acknowledged','help_resolved','problem_report'],signins:['sign_in']};
  const where:string[]=[],args:any[]=[];
  if(b.category==='all')where.push("a.action <> 'sign_in'");else{where.push('a.action IN ('+groups[b.category].map(()=>'?').join(',')+')');args.push(...groups[b.category]);}
  if(b.q){where.push('(LOWER(COALESCE(p.name,\'\')) LIKE ? OR LOWER(COALESCE(t.name,\'\')) LIKE ? OR LOWER(a.action) LIKE ?)');const q='%'+b.q.toLowerCase()+'%';args.push(q,q,q);}
  const joins=' FROM audit_logs a LEFT JOIN profiles p ON p.id=a.user_id LEFT JOIN profiles t ON t.id=a.target LEFT JOIN vehicles v ON v.id=a.target LEFT JOIN organizations o ON o.id=a.org_id LEFT JOIN activity_details d ON d.audit_id=a.id WHERE '+where.join(' AND ');
  const [count]=await db.query('SELECT COUNT(*) AS total'+joins,args);
  const items=await db.query('SELECT a.id,a.action,a.created_at,p.name AS actor,t.name AS person,v.id AS vehicle_id,o.name AS organization,d.description'+joins+' ORDER BY a.created_at DESC,a.id DESC LIMIT 25 OFFSET ?',[...args,(b.page-1)*25]);
  res.json({items,total:Number(count.total),page:b.page});
 });
}
