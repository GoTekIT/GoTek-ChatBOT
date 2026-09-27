import pg from 'pg';
import {readFileSync} from 'node:fs';
export const pool=new pg.Pool(process.env.DATABASE_URL?{connectionString:process.env.DATABASE_URL}:JSON.parse(readFileSync('.local/runtime.json','utf8')));
export async function transaction<T>(fn:(db:pg.PoolClient)=>Promise<T>){const db=await pool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
export async function scope(db:pg.PoolClient,workspace:string){await db.query("SELECT set_config('app.workspace_id',$1,true)",[workspace]);}
