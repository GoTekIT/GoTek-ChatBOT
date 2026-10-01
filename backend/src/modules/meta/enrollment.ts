import {randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import type {Identity} from '../../middlewares/auth.middleware';
import {requirePermission} from '../../core/authorization';
import {HttpError} from '../../core/security';
import {encryptMetaToken,decryptMetaToken} from './security';
import type {FacebookGrant} from './facebook-oauth';

export function metaEncryptionKey():string {
 const key=process.env.META_TOKEN_ENCRYPTION_KEY||'';
 if(!/^[a-f0-9]{64}$/i.test(key))throw new HttpError(503,'META_NOT_CONFIGURED');
 return key;
}
/** Caller revalidates identity after the provider request, in this transaction. */
export async function saveFacebookEnrollment(db:PoolClient,actor:Identity,grant:FacebookGrant,key:string):Promise<string> {
 requirePermission(actor.role,'channels.manage');
 const id=randomUUID();
 const ciphertext=encryptMetaToken(JSON.stringify(grant),key,actor.workspace_id,'enrollment:'+id);
 await db.query(`INSERT INTO meta_enrollments(id,workspace_id,user_id,session_hash,provider,grant_ciphertext,expires_at)
 VALUES($1,$2,$3,$4,'facebook',$5,now()+make_interval(secs=>$6))`,
 [id,actor.workspace_id,actor.user_id,actor.token_hash,ciphertext,Math.min(600,grant.expiresIn??600)]);
 return id;
}
/** Token stays server-side. Locks enrollment to serialize selection/consumption. */
export async function readFacebookEnrollment(db:PoolClient,actor:Identity,id:string,key:string):Promise<FacebookGrant> {
 requirePermission(actor.role,'channels.manage');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(400,'META_ENROLLMENT_INVALID');
 const result=await db.query(`SELECT grant_ciphertext FROM meta_enrollments WHERE id=$1 AND workspace_id=$2
 AND user_id=$3 AND session_hash=$4 AND provider='facebook' AND expires_at>now() FOR UPDATE`,[id,actor.workspace_id,actor.user_id,actor.token_hash]);
 if(!result.rowCount)throw new HttpError(400,'META_ENROLLMENT_INVALID');
 try {return JSON.parse(decryptMetaToken(result.rows[0].grant_ciphertext,key,actor.workspace_id,'enrollment:'+id)) as FacebookGrant;}
 catch {throw new HttpError(503,'META_CREDENTIAL_UNAVAILABLE');}
}
