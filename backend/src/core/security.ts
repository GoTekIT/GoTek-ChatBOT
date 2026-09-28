import {randomBytes,createHash,randomUUID} from 'node:crypto';
import argon2 from 'argon2';
import type {PoolClient} from 'pg';
export const uuid=randomUUID;
export const opaque=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const hashPassword=(password:string)=>argon2.hash(password,{type:argon2.argon2id,memoryCost:19456,timeCost:2,parallelism:1});
export const verifyPassword=(hash:string,password:string)=>argon2.verify(hash,password);
export class HttpError extends Error{constructor(public status:number,public code:string){super(code);}}
export function requireRole(role:string,allowed=['Owner','Admin']){if(!allowed.includes(role))throw new HttpError(403,'FORBIDDEN');}
export async function audit(db:PoolClient,workspace:string,actor:string,action:string,object:string){await db.query('INSERT INTO audit_events(id,workspace_id,actor_id,action,object_id) VALUES($1,$2,$3,$4,$5)',[uuid(),workspace,actor,action,object]);}
export async function challenge(db:PoolClient,user:string,kind:'verify'|'reset'){
 const token=opaque();await db.query('UPDATE challenges SET used_at=now() WHERE user_id=$1 AND kind=$2 AND used_at IS NULL',[user,kind]);
 await db.query("INSERT INTO challenges(id,user_id,kind,token_hash,expires_at) VALUES($1,$2,$3,$4,now()+$5::interval)",[uuid(),user,kind,digest(token),kind==='reset'?'30 minutes':'24 hours']);
 await db.query('INSERT INTO local_delivery(id,user_id,kind,payload) VALUES($1,$2,$3,$4)',[uuid(),user,kind,JSON.stringify({token})]);
}
