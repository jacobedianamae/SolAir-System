import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
export interface IdentityProvider {
 name:'local'|'supabase';
 authenticate(email:string,password:string):Promise<string|null>;
 createUser(email:string,password:string):Promise<string>;
 registerApplicant?(email:string,password:string):Promise<string>;
 emailVerified?(id:string):Promise<boolean>;
 requestEmailChange?(email:string,password:string,newEmail:string):Promise<void>;
 removeUser?(id:string):Promise<void>;
 requestRecovery?(email:string):Promise<void>;
 recoverPassword?(accessToken:string,refreshToken:string,password:string):Promise<string>;
}
export class SupabaseIdentity implements IdentityProvider {
 name='supabase' as const;
 constructor(private url:string,private anonKey:string,private serviceKey:string,private publicUrl:string){}
 private client(key:string){return createClient(this.url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});}
 async authenticate(email:string,password:string){const client=this.client(this.anonKey);const {data,error}=await client.auth.signInWithPassword({email,password});if(error||!data.user)return null;const id=data.user.id;await client.auth.signOut({scope:'local'});return id;}
 async createUser(email:string,password:string){const admin=this.client(this.serviceKey).auth.admin;const {data,error}=await admin.inviteUserByEmail(email,{redirectTo:this.publicUrl+'/reset-password'});if(error||!data.user)throw new Error('Verified account invitation could not be created');const result=await admin.updateUserById(data.user.id,{password});if(result.error){await admin.deleteUser(data.user.id);throw new Error('Account password could not be configured');}return data.user.id;}
 async requestEmailChange(email:string,password:string,newEmail:string){const client=this.client(this.anonKey);const login=await client.auth.signInWithPassword({email,password});if(login.error||!login.data.user)throw new Error('Current password could not be verified');try{const {error}=await client.auth.updateUser({email:newEmail},{emailRedirectTo:this.publicUrl+'/reset-password'});if(error)throw new Error('Email change could not be requested');}finally{await client.auth.signOut({scope:'local'});}}
 async registerApplicant(email:string,password:string){const {data,error}=await this.client(this.anonKey).auth.signUp({email,password,options:{emailRedirectTo:this.publicUrl+'/reset-password'}});if(error||!data.user||data.session)throw new Error('Account creation requires configured email confirmation');const actual=await this.client(this.serviceKey).auth.admin.getUserById(data.user.id);if(actual.error||actual.data.user?.email?.toLowerCase()!==email.toLowerCase())throw new Error('An account may already exist. Sign in or recover your password.');return data.user.id;}
 async emailVerified(id:string){const {data,error}=await this.client(this.serviceKey).auth.admin.getUserById(id);return !error&&!!data.user?.email_confirmed_at;}
 async removeUser(id:string){await this.client(this.serviceKey).auth.admin.deleteUser(id);}
 async requestRecovery(email:string){const {error}=await this.client(this.anonKey).auth.resetPasswordForEmail(email,{redirectTo:this.publicUrl+'/reset-password'});if(error)throw new Error('Password recovery request could not be submitted');}
 async recoverPassword(access_token:string,refresh_token:string,password:string){const client=this.client(this.anonKey);const session=await client.auth.setSession({access_token,refresh_token});if(session.error)throw new Error('Recovery link is invalid or expired');const {data,error}=await client.auth.updateUser({password});if(error||!data.user)throw new Error('Password update failed');await client.auth.signOut({scope:'global'});return data.user.id;}
}
export function identityProvider():IdentityProvider|null{
 if(process.env.SOLAIR_AUTH_PROVIDER!=='supabase')return null;
 const {SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,SOLAIR_PUBLIC_URL}=process.env;
 if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!SUPABASE_SERVICE_ROLE_KEY||!SOLAIR_PUBLIC_URL)throw new Error('Supabase auth requires SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and SOLAIR_PUBLIC_URL');
 return new SupabaseIdentity(SUPABASE_URL,SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,SOLAIR_PUBLIC_URL.replace(/\/$/,''));
}
export const localIdentityId=()=>randomUUID();
