import {useEffect,useId,useRef,useState} from 'react';
import {ChevronDown} from 'lucide-react';
import {api} from './api';
import type {Profile,Vehicle} from './types';

export default function TodaMenu({user,organization,selectedVehicle}:{user:Profile;organization:string;selectedVehicle?:Vehicle}){
 const [open,setOpen]=useState(false),[details,setDetails]=useState<any>(null),[error,setError]=useState('');
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId();
 useEffect(()=>{
  if(!open)return;let active=true;setDetails(null);setError('');
  void api('/registration').then(value=>{if(active)setDetails(value);}).catch(e=>{if(active)setError(e.message);});
  const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{active=false;document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open,user.id,user.org_id]);
 const vehicles=user.role==='driver'?(details?.vehicles||[]):selectedVehicle?[selectedVehicle]:[];
 return <div className="toda-menu" ref={root}>
  <button className="organization" ref={trigger} aria-label="Show TODA and vehicle" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)}>
   <span className="org-avatar">{organization==='No TODA assigned'?'—':organization.split(/\s+/).filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase()}</span>
   <span className="toda-trigger-label">{organization}<small>{user.role.toUpperCase()} WORKSPACE</small></span><ChevronDown size={15} aria-hidden="true" className={open?'expanded':''}/>
  </button>
  {open&&<section id={id} className="toda-dropdown" role="region" aria-label="TODA and vehicle">
   {!details&&!error&&<p role="status">Loading assignment…</p>}{error&&<p role="alert">Could not load assignment. Close and reopen to try again.</p>}
   {details&&<><span className="toda-detail-label">TODA</span><strong>{details.organization}</strong><span className="toda-detail-label">{user.role==='driver'?'Assigned vehicle':'Selected vehicle'}</span>{vehicles.length?vehicles.map((vehicle:any)=><div className="toda-vehicle" key={vehicle.id}><strong>{vehicle.id}</strong><span>{vehicle.model}</span></div>):<p>{user.role==='driver'?'No assigned vehicle':'No selected vehicle'}</p>}</>}
  </section>}
 </div>;
}
