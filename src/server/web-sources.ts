import type {PoolClient} from 'pg';import {z} from 'zod';import {audit,requireRole,uuid,HttpError} from './security';import {validateWebSourceUrl} from './web-source-security';import {validateFetchPolicy} from './web-source-policy';
const input=z.object({name:z.string().trim().min(1).max(150),url:z.string().url().max(2000),type:z.enum(['URL','SITEMAP','RSS']),maxPages:z.number().int().min(1).max(20).optional(),depth:z.number().int().min(0).max(2).optional(),delayMs:z.number().int().min(0).max(60000).optional(),maxBytes:z.number().int().min(1).max(20000000).optional(),timeoutMs:z.number().int().min(100).max(60000).optional(),maxRedirects:z.number().int().min(0).max(5).optional()}).strict();
export async function listWebSources(db:PoolClient,actor:any){requireRole(actor.role);return (await db.query('SELECT id,name,url,type,status,max_pages,depth,delay_ms,max_bytes,timeout_ms,max_redirects,created_at,updated_at FROM web_sources WHERE workspace_id=$1 ORDER BY updated_at DESC',[actor.workspace_id])).rows;}
export async function createWebSource(db:PoolClient,actor:any,body:unknown){requireRole(actor.role);const d=input.parse(body),policy=validateFetchPolicy({maxPages:d.maxPages,maxDepth:d.depth,delayMs:d.delayMs,maxBytes:d.maxBytes,timeoutMs:d.timeoutMs,maxRedirects:d.maxRedirects}),url=await validateWebSourceUrl(d.url),id=uuid();const row=(await db.query('INSERT INTO web_sources(id,workspace_id,name,url,type,max_pages,depth,delay_ms,max_bytes,timeout_ms,max_redirects,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id,name,url,type,status,max_pages,depth,delay_ms,max_bytes,timeout_ms,max_redirects,created_at,updated_at',[id,actor.workspace_id,d.name,url,d.type,policy.maxPages,policy.maxDepth,policy.delayMs,policy.maxBytes,policy.timeoutMs,policy.maxRedirects,actor.user_id])).rows[0];await audit(db,actor.workspace_id,actor.user_id,'web_source.created',id);return row;}
export async function setWebSourceStatus(db:PoolClient,actor:any,id:string,body:unknown){requireRole(actor.role);const status=z.object({status:z.enum(['ACTIVE','PAUSED'])}).strict().parse(body).status;const row=(await db.query('UPDATE web_sources SET status=$1,updated_at=now() WHERE id=$2 AND workspace_id=$3 RETURNING id,name,url,type,status,max_pages,depth,delay_ms,max_bytes,timeout_ms,max_redirects,created_at,updated_at',[status,z.string().uuid().parse(id),actor.workspace_id])).rows[0];if(!row)throw new HttpError(404,'NOT_FOUND');await audit(db,actor.workspace_id,actor.user_id,status==='ACTIVE'?'web_source.activated':'web_source.paused',id);return row;}

import {fetchWebSource} from './web-source-fetch';
import {parseWebSource} from './web-source-parsers';
export async function previewWebSource(db:PoolClient,actor:any,id:string){
 requireRole(actor.role);const row=(await db.query('SELECT id,url,type,max_pages,depth,delay_ms,max_bytes,timeout_ms,max_redirects,status FROM web_sources WHERE id=$1 AND workspace_id=$2',[z.string().uuid().parse(id),actor.workspace_id])).rows[0];if(!row)throw new HttpError(404,'NOT_FOUND');if(row.status!=='ACTIVE')throw new HttpError(409,'SOURCE_PAUSED');
 const fetched=await fetchWebSource(row.url,{maxPages:row.max_pages,maxDepth:row.depth,delayMs:row.delay_ms,maxBytes:row.max_bytes,timeoutMs:row.timeout_ms,maxRedirects:row.max_redirects});const parsed=parseWebSource(row.type,fetched.body,fetched.contentType,{maxPages:row.max_pages,maxDepth:row.depth,delayMs:row.delay_ms,maxBytes:row.max_bytes,timeoutMs:row.timeout_ms,maxRedirects:row.max_redirects});await audit(db,actor.workspace_id,actor.user_id,'web_source.previewed',id);return {sourceId:id,url:fetched.url,status:fetched.status,contentType:fetched.contentType,items:parsed.items};
}

import {enqueueJob} from './jobs';
/** Queue only: fetching and publication are separate worker/review steps. */
export async function requestWebSourceRefresh(db:PoolClient,actor:any,id:string,body:unknown){
 requireRole(actor.role);
 const sourceId=z.string().uuid().parse(id);
 const {requestId}=z.object({requestId:z.string().uuid()}).strict().parse(body);
 const source=(await db.query('SELECT status FROM web_sources WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[actor.workspace_id,sourceId])).rows[0];
 if(!source)throw new HttpError(404,'NOT_FOUND');
 if(source.status!=='ACTIVE')throw new HttpError(409,'SOURCE_PAUSED');
 const key=`web-refresh:${requestId}`;
 const existing=(await db.query('SELECT id FROM jobs WHERE workspace_id=$1 AND idempotency_key=$2',[actor.workspace_id,key])).rows[0];
 const job=await enqueueJob(db,actor.workspace_id,{kind:'web.refresh',key,payload:{sourceId},external:false,maxAttempts:3});
 if(!existing)await audit(db,actor.workspace_id,actor.user_id,'web_source.refresh_requested',sourceId);
 return {jobId:job.id,sourceId,state:job.state};
}

export async function listWebSourceSnapshots(db:PoolClient,actor:any,id:string){
 requireRole(actor.role);const sourceId=z.string().uuid().parse(id);
 if(!(await db.query('SELECT id FROM web_sources WHERE workspace_id=$1 AND id=$2',[actor.workspace_id,sourceId])).rowCount)throw new HttpError(404,'NOT_FOUND');
 return (await db.query('SELECT id,job_id,content_hash,created_at FROM web_source_snapshots WHERE workspace_id=$1 AND source_id=$2 ORDER BY created_at DESC,id DESC LIMIT 50',[actor.workspace_id,sourceId])).rows;
}
export async function readWebSourceSnapshot(db:PoolClient,actor:any,sourceId:string,id:string){
 requireRole(actor.role);
 const row=(await db.query('SELECT id,source_id,job_id,content_hash,document,created_at FROM web_source_snapshots WHERE workspace_id=$1 AND source_id=$2 AND id=$3',[actor.workspace_id,z.string().uuid().parse(sourceId),z.string().uuid().parse(id)])).rows[0];
 if(!row)throw new HttpError(404,'NOT_FOUND');return row;
}
