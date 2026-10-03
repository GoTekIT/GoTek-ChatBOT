import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import type {PoolClient} from 'pg';
import {HttpError} from '../../core/security';
import {MetaRepository} from '../../repositories/meta.repository';

function encryptionKey():Buffer {
 const encoded=process.env.META_CREDENTIAL_ENCRYPTION_KEY;
 if(!encoded||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw new HttpError(503,'META_CREDENTIAL_KEY_NOT_CONFIGURED');
 const key=Buffer.from(encoded,'base64');
 if(key.length!==32)throw new HttpError(503,'META_CREDENTIAL_KEY_NOT_CONFIGURED');
 return key;
}
/** Context binds ciphertext to its tenant and purpose; tokens never enter logs. */
export function sealMetaSecret(value:string,context:string):string {
 if(!value||value.length>16384)throw new HttpError(400,'META_CREDENTIAL_INVALID');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
 cipher.setAAD(Buffer.from(context));
 const ciphertext=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),ciphertext.toString('base64')].join('.');
}
export function openMetaSecret(value:string,context:string):string {
 const key=encryptionKey();
 try {
  const parts=value.split('.');if(parts.length!==4||parts[0]!=='v1')throw new Error();
  const iv=Buffer.from(parts[1],'base64'),tag=Buffer.from(parts[2],'base64');
  if(iv.length!==12||tag.length!==16)throw new Error();
  const decipher=createDecipheriv('aes-256-gcm',key,iv);decipher.setAAD(Buffer.from(context));decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(Buffer.from(parts[3],'base64')),decipher.final()]).toString('utf8');
 }catch{throw new HttpError(503,'META_CREDENTIAL_DECRYPT_FAILED');}
}
const context=(workspace:string,connection:string)=>`meta-page-token:${workspace}:${connection}`;
export async function storeMetaCredential(db:PoolClient,workspace:string,connection:string,token:string){
 const encrypted=sealMetaSecret(token,context(workspace,connection));
 await MetaRepository.storeCredential(db,workspace,connection,encrypted);
}
export async function resolveMetaCredential(db:PoolClient,workspace:string,connection:string,legacyRef:string):Promise<string>{
 const row=await MetaRepository.findCredential(db,workspace,connection);
 if(row)return openMetaSecret(row.encrypted_token,context(workspace,connection));
 const token=process.env[legacyRef]?.trim();
 if(!token)throw new HttpError(503,'META_TOKEN_NOT_CONFIGURED');
 return token;
}
