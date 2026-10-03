import type {PoolClient} from 'pg';
import {HttpError} from '../../core/security';

/** Check the authenticated login, not a caller-controlled session setting. */
export async function assertMetaWorkerRole(db:PoolClient):Promise<void>{
 const role=(await db.query(`SELECT session_user AS login,current_user AS effective,
  rolsuper,rolbypassrls FROM pg_roles WHERE rolname=session_user`)).rows[0];
 if(!role||role.login!=='gotek_meta_worker'||role.effective!=='gotek_meta_worker'||role.rolsuper!==false||role.rolbypassrls!==false){
  throw new HttpError(503,'META_WORKER_ROLE_INVALID');
 }
}
