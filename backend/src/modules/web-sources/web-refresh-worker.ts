import {createHash,randomUUID} from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {scope,transaction} from '../../core/db';
import {HttpError} from '../../core/security';
import {runWorkerOnce,type JobHandler} from '../../modules/jobs/worker';
import {fetchWebSource} from './web-source-fetch';
import {parseWebSource} from './web-source-parsers';
import {crawlSitemap} from './web-sitemap-crawl';
import {crawlWebSource} from './web-source-crawl';

/** Crawl URL sources; sitemap entries remain a manifest, never published knowledge. */
export function runWebRefreshOnce(workspace:string,fetcher:typeof fetchWebSource=fetchWebSource){
 z.string().uuid().parse(workspace);
 const scoped=<T>(fn:(db:PoolClient)=>Promise<T>)=>transaction(async db=>{await scope(db,workspace);return fn(db);});
 const handler:JobHandler=async job=>{
  const {sourceId}=z.object({sourceId:z.string().uuid()}).strict().parse(job.payload);
  const lease=(job as typeof job & {lease_token:string}).lease_token;
  const current=async(db:PoolClient)=>{
   if(!(await db.query("SELECT id FROM workspaces WHERE id=$1 AND status='active' FOR SHARE",[workspace])).rowCount)throw new HttpError(409,'WORKSPACE_DISABLED');
   if(!(await db.query("SELECT id FROM jobs WHERE id=$1 AND workspace_id=$2 AND state='running' AND lease_token=$3 AND lease_until>clock_timestamp() FOR UPDATE",[job.id,workspace,lease])).rowCount)throw new HttpError(409,'STALE_JOB_LEASE');
   const source=(await db.query('SELECT url,type,status,max_pages,depth,delay_ms,max_bytes,timeout_ms,max_redirects FROM web_sources WHERE workspace_id=$1 AND id=$2 FOR SHARE',[workspace,sourceId])).rows[0];
   if(!source)throw new HttpError(404,'NOT_FOUND');
   if(source.status!=='ACTIVE')throw new HttpError(409,'SOURCE_PAUSED');
   return source;
  };
  const prepared=await scoped(async db=>{
   const source=await current(db);
   const prior=(await db.query('SELECT id FROM web_source_snapshots WHERE workspace_id=$1 AND job_id=$2',[workspace,job.id])).rows[0];
   return {source,prior};
  });
  if(prepared.prior)return {receipt:`web-snapshot:${prepared.prior.id}`};
  const s=prepared.source;
  // Stay within the worker's 30-second lease; final commit rejects expired leases.
  const policy={maxPages:s.max_pages,maxDepth:s.depth,delayMs:s.delay_ms,maxBytes:s.max_bytes,timeoutMs:Math.min(s.timeout_ms,25000),maxRedirects:s.max_redirects};
  const document=s.type==='URL'?await crawlWebSource(s.url,policy,fetcher):s.type==='SITEMAP'?await crawlSitemap(s.url,policy,fetcher):await (async()=>{
   const fetched=await fetcher(s.url,policy);
   const parsed=parseWebSource(s.type,fetched.body,fetched.contentType,policy);
   return {url:fetched.url,status:fetched.status,...parsed};
  })();
  const contentHash=createHash('sha256').update(JSON.stringify(document)).digest('hex');
  return scoped(async db=>{
   const latest=await current(db);
   if(JSON.stringify(latest)!==JSON.stringify(s))throw new HttpError(409,'SOURCE_CHANGED');
   const id=randomUUID();
   await db.query('INSERT INTO web_source_snapshots(id,workspace_id,source_id,job_id,content_hash,document) VALUES($1,$2,$3,$4,$5,$6)',[id,workspace,sourceId,job.id,contentHash,document]);
   return {receipt:`web-snapshot:${id}`};
  });
 };
 return runWorkerOnce(workspace,{'web.refresh':handler});
}
