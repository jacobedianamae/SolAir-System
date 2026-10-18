import type {Express,RequestHandler} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Store} from './db';
import type {User} from './auth';
import {registrationRoutes} from './registration';

export function administrationRoutes(app:Express,db:Store,auth:RequestHandler,notify:(org:string)=>void){
 registrationRoutes(app,db,auth);
 const managers:RequestHandler=(req:any,res,next)=>['admin','operator'].includes(req.user.role)?next():void res.sendStatus(403);
 app.get('/api/people',auth,managers,async(req:any,res)=>{
  const u=req.user as User;
  const b=z.object({q:z.string().max(100).default(''),page:z.coerce.number().int().min(1).max(100000).default(1),status:z.enum(['all','unassigned','driver','operator','engineer','admin']).default('all')}).parse(req.query);
  const clauses=['1=1'],args:any[]=[];
  if(u.role!=='admin'){clauses.push('p.org_id=?');args.push(u.org_id);}
  if(b.q){clauses.push('(LOWER(p.name) LIKE ? OR LOWER(p.email) LIKE ?)');const q='%'+b.q.toLowerCase()+'%';args.push(q,q);}
  if(b.status==='unassigned')clauses.push("p.org_id LIKE 'unassigned-%'");
  else if(b.status!=='all'){clauses.push('p.role=?');args.push(b.status);}
  const where=clauses.join(' AND '),[count]=await db.query('SELECT COUNT(*) AS total FROM profiles p WHERE '+where,args);
  const items=await db.query('SELECT p.id,p.name,p.email,p.role,p.org_id,o.name AS organization,r.requested_role FROM profiles p JOIN organizations o ON o.id=p.org_id LEFT JOIN registration_preferences r ON r.user_id=p.id WHERE '+where+' ORDER BY LOWER(p.name),p.id LIMIT 25 OFFSET ?',[...args,(b.page-1)*25]);
  res.json({items,total:Number(count.total),page:b.page,page_size:25});
 });
 app.patch('/api/admin/people/:id',auth,async(req:any,res)=>{
  const u=req.user as User;if(u.role!=='admin')return res.sendStatus(403);
  const b=z.object({name:z.string().trim().min(1).max(80),role:z.enum(['driver','operator','engineer']),org_id:z.string().min(1),expected_org_id:z.string().min(1)}).strict().parse(req.body);
  const [person]=await db.query('SELECT * FROM profiles WHERE id=?',[req.params.id]);
  if(!person||person.id===u.id||person.role==='admin')return res.status(403).json({error:'Administrator accounts require the protected administrator workflow'});
  if(person.org_id!==b.expected_org_id)return res.status(409).json({error:'Account changed. Refresh the directory before saving.'});
  if(!person.org_id.startsWith('unassigned-')&&person.org_id!==b.org_id)return res.status(409).json({error:'Moving an established fleet member requires a separate history review.'});
  const [org]=await db.query("SELECT id,name FROM organizations WHERE id=? AND id NOT LIKE 'unassigned-%'",[b.org_id]);
  if(!org)return res.status(400).json({error:'Choose an existing TODA organization'});
  await db.transaction(async tx=>{
   const [changed]=await tx.query('UPDATE profiles SET name=?,role=?,org_id=? WHERE id=? AND org_id=? AND role=? RETURNING id',[b.name,b.role,b.org_id,person.id,person.org_id,person.role]);
   if(!changed)throw new Error('Account changed during update; refresh and retry');
   if(person.org_id!==b.org_id||b.role!=='driver')await tx.run('DELETE FROM assignments WHERE driver_id=?',[person.id]);
   if(person.org_id!==b.org_id||b.role!=='operator')await tx.run('UPDATE device_operation SET commissioned=0,operator_id=NULL WHERE operator_id=?',[person.id]);
   if(person.org_id!==b.org_id||b.role!=='operator')await tx.run('DELETE FROM vehicle_operators WHERE operator_id=?',[person.id]);
   await tx.run('DELETE FROM sessions WHERE user_id=?',[person.id]);
   const auditId=randomUUID();await tx.run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)',[auditId,u.org_id,u.id,'account_membership_updated',person.id,new Date().toISOString()]);
   await tx.run('INSERT INTO activity_details VALUES (?,?)',[auditId,`${person.name}: ${person.role} to ${b.role}; TODA: ${org.name}`]);
  });notify(person.org_id);notify(b.org_id);res.json({ok:true,message:'Account updated. Saved TODA: '+org.name+'. Existing sessions were signed out; sign in again. Assign a vehicle separately.'});
 });
 app.post('/api/access-requests/:id/archive',auth,async(req:any,res)=>{
  const u=req.user as User;if(u.role!=='admin')return res.sendStatus(403);
  const [request]=await db.query("SELECT id FROM access_requests WHERE id=? AND status='pending'",[req.params.id]);
  if(!request)return res.status(409).json({error:'Legacy request already handled'});
  await db.transaction(async tx=>{
   await tx.run("UPDATE access_requests SET status='rejected',reviewed_by=?,reviewed_at=? WHERE id=? AND status='pending'",[u.id,new Date().toISOString(),request.id]);
   await tx.run('INSERT INTO audit_logs VALUES (?,?,?,?,?,?)',[randomUUID(),u.org_id,u.id,'legacy_request_archived',request.id,new Date().toISOString()]);
  });res.json({ok:true});
 });
}
