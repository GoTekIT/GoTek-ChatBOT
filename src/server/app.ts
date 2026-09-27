import {readSchedule,setSchedule} from './web-source-schedule';
import {listAuditEvents} from './audit-log';
import {exportAuditEvents} from './audit-export';
import {stageWebSnapshotGeneration} from './web-snapshot-generation';
import {createContact,listContacts,getContact,updateContact,deleteContact,restoreContact,mergeContacts,previewMergeContacts,undoMergeContacts,exportContacts,setContactTags,listContactTags} from './contacts';
import {createWebGeneration,publishWebGeneration,rollbackWebGeneration} from './web-generations';
import {importWebSnapshotKnowledge} from './web-snapshot-knowledge';
import {createHash} from 'node:crypto';
import {listKnowledgeCategories,createKnowledgeCategory} from './knowledge-categories';
import express,{type Request,type Response,type NextFunction} from 'express';
import multer from 'multer';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {widgetRouter} from './widget';import {widgetEmbed} from './widget-embed';
import {inboxResumeAi,inboxList,inboxMessages,inboxTakeover,inboxSend,inboxSetStatus} from './inbox';
import {createChannel,listChannels,channelInstallation,channelSettings,updateChannelSettings,channelAgents,updateChannelAgents,updateChannelState} from './channels';
import {listSupport,createSupport,revokeSupport} from './support';
import {platformRoutes} from './platform';
import {jobMetadata} from './jobs';
import {usageSummary} from './quota';
import {listRules,createRule,updateRule,setRuleState} from './rules';
import {exportRules,importRules} from './rules-transfer';
import {listKnowledge,getKnowledge,createKnowledge,updateKnowledge,importKnowledgeBatch,importKnowledgeFile} from './knowledge';
import {beginKnowledgeImport,completeKnowledgeImport,getKnowledgeImport,getKnowledgeImportFile,listKnowledgeImports,failKnowledgeImport} from './knowledge-imports';
import {retrieveStoredChunks} from './knowledge-chunk-store';
import {extractDocumentText} from './document-extract';
import {processKnowledge,publishKnowledge,rollbackKnowledge} from './knowledge-lifecycle';
import {retrieveKnowledge} from './knowledge-retrieval';
import {getDataCollectionConfig,saveDataCollectionConfig,completeDataCollection} from './data-collection';
import {createCitation,listCitations,revokeCitation} from './active-citations';
import {createOnboardingSource,listOnboardingSources,setOnboardingReady} from './onboarding';
import {listWebSources,createWebSource,setWebSourceStatus,previewWebSource,requestWebSourceRefresh,listWebSourceSnapshots,readWebSourceSnapshot} from './web-sources';
import {transaction,scope} from './db';
import {uuid,opaque,digest,hashPassword,verifyPassword,HttpError,requireRole,audit,challenge} from './security';

const email=z.string().trim().email().max(254).transform(v=>v.toLowerCase());
const password=z.string().min(12).max(128);
const uid=z.string().uuid();
const success={ok:true};
const generic={ok:true,message:'Nếu thông tin hợp lệ, hướng dẫn sẽ được gửi.'};
const cookieOptions={httpOnly:true,sameSite:'lax' as const,secure:process.env.COOKIE_SECURE==='true',path:'/'};
type Identity={user_id:string,workspace_id:string,role:string,token_hash:string};
export async function identity(db:PoolClient,req:Request):Promise<Identity>{
 const raw=req.cookies?.gotek_session;if(!raw)throw new HttpError(401,'UNAUTHENTICATED');
 const found=await db.query(`SELECT s.*,m.role FROM sessions s JOIN memberships m ON m.user_id=s.user_id AND m.workspace_id=s.workspace_id AND m.active WHERE s.token_hash=$1 AND s.expires_at>now() FOR UPDATE OF s FOR SHARE OF m`,[digest(raw)]);
 if(!found.rowCount)throw new HttpError(401,'UNAUTHENTICATED');const i=found.rows[0];await scope(db,i.workspace_id);
 if(!(await db.query("SELECT 1 FROM workspaces WHERE id=$1 AND status='active'",[i.workspace_id])).rowCount)throw new HttpError(403,'WORKSPACE_DISABLED');return i;
}
export function createApp(){
 const app=express();const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:2_000_000,files:1,fields:2,parts:3,fieldSize:4096}});const uploadRate=rateLimit({windowMs:60_000,limit:10,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'RATE_LIMITED'}});app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:false}));app.use(express.json({limit:'128kb'}));app.use(cookieParser());
 app.get('/widget.js',widgetEmbed);app.use('/widget-api',widgetRouter());
 app.use('/api',(req,res,next)=>{res.set('Cache-Control','no-store');if(!['GET','HEAD','OPTIONS'].includes(req.method)){
 const origin=req.get('origin');const allowed=process.env.APP_ORIGIN||'http://127.0.0.1:4317';
 if((origin&&origin!==allowed)||req.get('x-gotek-request')!=='1')return next(new HttpError(403,'CSRF_REJECTED'));
 }next();});
 app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:100,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'RATE_LIMITED'}}));
 app.get('/api/health',(_req,res)=>res.json({status:'ok',environment:'local-test',externalDelivery:false}));
 app.post('/api/auth/signup',async(req,res)=>{
 const data=z.object({fullName:z.string().trim().min(2).max(120),business:z.string().trim().min(2).max(160),email,phone:z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/),referral:z.string().max(80).optional(),password}).strict().parse(req.body);
 const hash=await hashPassword(data.password);
 await transaction(async db=>{
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[data.email]);
 if((await db.query('SELECT 1 FROM users WHERE email=$1',[data.email])).rowCount)return;
 const user=uuid(),workspace=uuid();await scope(db,workspace);
 await db.query('INSERT INTO users(id,email,full_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)',[user,data.email,data.fullName,data.phone,hash]);
 await db.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[workspace,data.business]);
 const defaultAiQuota=Number.parseInt(process.env.GOTEK_DEFAULT_AI_RESPONSE_QUOTA||'1000',10);
 if(!Number.isSafeInteger(defaultAiQuota)||defaultAiQuota<0)throw new HttpError(500,'INVALID_DEFAULT_QUOTA');
 await db.query("INSERT INTO quota_budgets(id,workspace_id,meter,period_start,period_end,limit_units) VALUES($1,$2,'ai_response',date_trunc('month',now()),date_trunc('month',now())+interval '1 month',$3)",[uuid(),workspace,defaultAiQuota]);
 await db.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Owner')",[workspace,user]);
 await challenge(db,user,'verify');await audit(db,workspace,user,'workspace.created',workspace);
 });res.status(202).json(generic);
 });
 app.post('/api/auth/login',async(req,res)=>{
 const data=z.object({email,password:z.string().max(128),remember:z.boolean().optional()}).strict().parse(req.body);
 const result=await transaction(async db=>{
 const user=(await db.query('SELECT * FROM users WHERE email=$1 FOR UPDATE',[data.email])).rows[0];
 if(!user){await hashPassword('nonexistent-account-dummy');throw new HttpError(401,'INVALID_CREDENTIALS');}
 if(!await verifyPassword(user.password_hash,data.password))throw new HttpError(401,'INVALID_CREDENTIALS');
 const memberships=(await db.query('SELECT workspace_id FROM memberships WHERE user_id=$1 AND active ORDER BY workspace_id',[user.id])).rows;
 let workspace:string|undefined;for(const m of memberships){await scope(db,m.workspace_id);if((await db.query("SELECT 1 FROM workspaces WHERE id=$1 AND status='active'",[m.workspace_id])).rowCount){workspace=m.workspace_id;break;}}
 if(!workspace)throw new HttpError(403,'NO_MEMBERSHIP');
 const token=opaque(),maxAge=(data.remember?30:1)*24*60*60*1000;
 await db.query("INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+$4::interval)",[digest(token),user.id,workspace,`${maxAge} milliseconds`]);await audit(db,workspace,user.id,'auth.login',user.id);return {token,maxAge};
 });res.cookie('gotek_session',result.token,{...cookieOptions,maxAge:result.maxAge}).json(success);
 });
 const authed=(fn:(db:PoolClient,i:Identity,req:Request)=>Promise<unknown>)=>async(req:Request,res:Response)=>{const result=await transaction(async db=>fn(db,await identity(db,req),req));res.json(result);};
 app.get('/api/me',authed(async(db,i)=>{
 const user=(await db.query('SELECT id,email,full_name,verified_at FROM users WHERE id=$1',[i.user_id])).rows[0];
 const rows=(await db.query('SELECT workspace_id,role FROM memberships WHERE user_id=$1 AND active',[i.user_id])).rows;const workspaces=[];
 for(const row of rows){await scope(db,row.workspace_id);const workspace=(await db.query("SELECT id,name,status FROM workspaces WHERE id=$1",[row.workspace_id])).rows[0];if(workspace)workspaces.push({...workspace,role:row.role});}
 await scope(db,i.workspace_id);return {user,workspaces,workspaceId:i.workspace_id,role:i.role,platformAdmin:!!(await db.query('SELECT 1 FROM platform_admins WHERE user_id=$1 AND active',[i.user_id])).rowCount};
 }));
 app.post('/api/auth/logout',async(req,res)=>{await transaction(async db=>{const token=req.cookies?.gotek_session;if(token)await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(token)]);});res.clearCookie('gotek_session',cookieOptions).json(success);});
 app.post('/api/auth/request-reset',async(req,res)=>{
 const data=z.object({email}).strict().parse(req.body);await transaction(async db=>{const user=(await db.query('SELECT id FROM users WHERE email=$1 FOR UPDATE',[data.email])).rows[0];if(!user)return;
 if((await db.query("SELECT 1 FROM challenges WHERE user_id=$1 AND kind='reset' AND created_at>now()-interval '60 seconds'",[user.id])).rowCount)return;await challenge(db,user.id,'reset');});res.status(202).json(generic);
 });
 app.post('/api/auth/reset',async(req,res)=>{
 const data=z.object({token:z.string().min(30).max(100),password}).strict().parse(req.body);const hash=await hashPassword(data.password);
 await transaction(async db=>{const candidate=(await db.query("SELECT user_id FROM challenges WHERE token_hash=$1",[digest(data.token)])).rows[0];if(!candidate)throw new HttpError(400,'INVALID_OR_EXPIRED_TOKEN');await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[candidate.user_id]);const c=(await db.query("UPDATE challenges SET used_at=now() WHERE token_hash=$1 AND kind='reset' AND used_at IS NULL AND expires_at>now() RETURNING user_id",[digest(data.token)])).rows[0];if(!c)throw new HttpError(400,'INVALID_OR_EXPIRED_TOKEN');await db.query('UPDATE users SET password_hash=$1 WHERE id=$2',[hash,c.user_id]);await db.query('DELETE FROM sessions WHERE user_id=$1',[c.user_id]);});res.clearCookie('gotek_session',cookieOptions).json(success);
 });
 app.post('/api/auth/verify',async(req,res)=>{const data=z.object({token:z.string().min(30).max(100)}).strict().parse(req.body);await transaction(async db=>{const candidate=(await db.query("SELECT user_id FROM challenges WHERE token_hash=$1",[digest(data.token)])).rows[0];if(!candidate)throw new HttpError(400,'INVALID_OR_EXPIRED_TOKEN');await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[candidate.user_id]);const c=(await db.query("UPDATE challenges SET used_at=now() WHERE token_hash=$1 AND kind='verify' AND used_at IS NULL AND expires_at>now() RETURNING user_id",[digest(data.token)])).rows[0];if(!c)throw new HttpError(400,'INVALID_OR_EXPIRED_TOKEN');await db.query('UPDATE users SET verified_at=now() WHERE id=$1',[c.user_id]);});res.json(success);});
 app.post('/api/auth/resend',authed(async(db,i)=>{await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[i.user_id]);if((await db.query('SELECT 1 FROM users WHERE id=$1 AND verified_at IS NOT NULL',[i.user_id])).rowCount)return success;if((await db.query("SELECT 1 FROM challenges WHERE user_id=$1 AND kind='verify' AND created_at>now()-interval '60 seconds'",[i.user_id])).rowCount)throw new HttpError(429,'RESEND_COOLDOWN');await challenge(db,i.user_id,'verify');return generic;}));
 app.get('/api/workspace',authed(async(db,i)=>(await db.query('SELECT id,name,language,status,seat_limit FROM workspaces WHERE id=$1',[i.workspace_id])).rows[0]));
 app.get('/api/usage/ai',authed(async(db,i,req)=>{requireRole(i.role);const filter=z.object({from:z.string().datetime({offset:true}).optional(),to:z.string().datetime({offset:true}).optional()}).strict().parse({from:req.query.from,to:req.query.to});if(filter.from&&filter.to&&new Date(filter.from)>new Date(filter.to))throw new HttpError(400,'INVALID_DATE_RANGE');const rows=(await db.query('SELECT provider,model,count(*)::int AS requests,sum(prompt_tokens)::bigint AS prompt_tokens,sum(completion_tokens)::bigint AS completion_tokens,sum(total_tokens)::bigint AS total_tokens,sum(cost_micros)::bigint AS cost_micros FROM ai_usage_ledger WHERE workspace_id=$1 AND ($2::timestamptz IS NULL OR created_at>=$2) AND ($3::timestamptz IS NULL OR created_at<$3) GROUP BY provider,model ORDER BY provider,model',[i.workspace_id,filter.from||null,filter.to||null])).rows;return rows;}));
 app.patch('/api/workspace',authed(async(db,i,req)=>{requireRole(i.role);const data=z.object({name:z.string().trim().min(2).max(160),language:z.enum(['vi','en'])}).strict().parse(req.body);const result=await db.query('UPDATE workspaces SET name=$1,language=$2 WHERE id=$3 RETURNING id,name,language',[data.name,data.language,i.workspace_id]);await audit(db,i.workspace_id,i.user_id,'workspace.updated',i.workspace_id);return result.rows[0];}));
 app.post('/api/workspace/switch',authed(async(db,i,req)=>{const {workspaceId}=z.object({workspaceId:uid}).strict().parse(req.body);if(!(await db.query('SELECT 1 FROM memberships WHERE user_id=$1 AND workspace_id=$2 AND active',[i.user_id,workspaceId])).rowCount)throw new HttpError(403,'FORBIDDEN');await scope(db,workspaceId);if(!(await db.query("SELECT 1 FROM workspaces WHERE id=$1 AND status='active'",[workspaceId])).rowCount)throw new HttpError(403,'WORKSPACE_DISABLED');await db.query('UPDATE sessions SET workspace_id=$1 WHERE token_hash=$2',[workspaceId,i.token_hash]);return success;}));
 app.get('/api/members',authed(async(db,i)=>{requireRole(i.role);return (await db.query('SELECT u.id,u.email,u.full_name,m.role,m.active FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 ORDER BY u.full_name',[i.workspace_id])).rows;}));
 app.patch('/api/members/:id',authed(async(db,i,req)=>{
 requireRole(i.role);const user=uid.parse(req.params.id);const data=z.object({role:z.enum(['Owner','Admin','Agent']),active:z.boolean()}).strict().parse(req.body);
 await db.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[i.workspace_id]);
 const current=(await db.query('SELECT role,active FROM memberships WHERE workspace_id=$1 AND user_id=$2',[i.workspace_id,user])).rows[0];if(!current)throw new HttpError(404,'NOT_FOUND');
 if((current.role==='Owner'||data.role==='Owner')&&i.role!=='Owner')throw new HttpError(403,'FORBIDDEN');
 if(current.role==='Owner'&&current.active&&(data.role!=='Owner'||!data.active)&&(await db.query("SELECT 1 FROM memberships WHERE workspace_id=$1 AND active AND role='Owner' AND user_id<>$2",[i.workspace_id,user])).rowCount===0)throw new HttpError(409,'LAST_OWNER');
 if(!current.active&&data.active){const limit=(await db.query('SELECT seat_limit FROM workspaces WHERE id=$1',[i.workspace_id])).rows[0].seat_limit;const count=Number((await db.query('SELECT count(*) FROM memberships WHERE workspace_id=$1 AND active',[i.workspace_id])).rows[0].count);if(count>=limit)throw new HttpError(409,'SEAT_LIMIT');}
 await db.query('UPDATE memberships SET role=$1,active=$2 WHERE workspace_id=$3 AND user_id=$4',[data.role,data.active,i.workspace_id,user]);await audit(db,i.workspace_id,i.user_id,'membership.updated',user);return success;
 }));
 app.get('/api/invitations',authed(async(db,i)=>{requireRole(i.role);return (await db.query('SELECT id,email,role,expires_at,accepted_at,revoked_at FROM invitations ORDER BY created_at DESC LIMIT 100')).rows;}));
 app.post('/api/invitations',authed(async(db,i,req)=>{
 requireRole(i.role);const data=z.object({email,role:z.enum(['Admin','Agent'])}).strict().parse(req.body);
 const w=(await db.query('SELECT seat_limit FROM workspaces WHERE id=$1 FOR UPDATE',[i.workspace_id])).rows[0];
 await db.query('UPDATE invitations SET revoked_at=now() WHERE expires_at<=now() AND accepted_at IS NULL AND revoked_at IS NULL');
 const seats=Number((await db.query('SELECT count(*) FROM memberships WHERE workspace_id=$1 AND active',[i.workspace_id])).rows[0].count)+Number((await db.query('SELECT count(*) FROM invitations WHERE workspace_id=$1 AND accepted_at IS NULL AND revoked_at IS NULL',[i.workspace_id])).rows[0].count);
 if(seats>=w.seat_limit)throw new HttpError(409,'SEAT_LIMIT');
 if((await db.query('SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=$1 AND u.email=$2 AND m.active',[i.workspace_id,data.email])).rowCount)throw new HttpError(409,'ALREADY_MEMBER');
 const id=uuid(),token=opaque();await db.query("INSERT INTO invitations(id,workspace_id,email,role,token_hash,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')",[id,i.workspace_id,data.email,data.role,digest(token)]);
 await db.query("INSERT INTO local_delivery(id,user_id,kind,payload) VALUES($1,$2,'invite',$3)",[uuid(),i.user_id,JSON.stringify({token,workspaceId:i.workspace_id,email:data.email})]);await audit(db,i.workspace_id,i.user_id,'invitation.created',id);return {id,status:'local_delivery'};
 }));
 app.post('/api/invitations/:id/revoke',authed(async(db,i,req)=>{requireRole(i.role);const id=uid.parse(req.params.id);if(!(await db.query('UPDATE invitations SET revoked_at=now() WHERE id=$1 AND accepted_at IS NULL RETURNING id',[id])).rowCount)throw new HttpError(404,'NOT_FOUND');await audit(db,i.workspace_id,i.user_id,'invitation.revoked',id);return success;}));
 app.post('/api/invitations/accept',authed(async(db,i,req)=>{
 const data=z.object({workspaceId:uid,token:z.string().min(30).max(100)}).strict().parse(req.body);await scope(db,data.workspaceId);
 const w=(await db.query("SELECT seat_limit FROM workspaces WHERE id=$1 AND status='active' FOR UPDATE",[data.workspaceId])).rows[0];if(!w)throw new HttpError(400,'INVALID_OR_EXPIRED_TOKEN');
 const invite=(await db.query('SELECT * FROM invitations WHERE token_hash=$1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE',[digest(data.token)])).rows[0];
 const user=(await db.query('SELECT email,verified_at FROM users WHERE id=$1',[i.user_id])).rows[0];if(!invite||invite.email!==user.email||!user.verified_at)throw new HttpError(400,'INVALID_OR_EXPIRED_TOKEN');
 const existing=(await db.query('SELECT active FROM memberships WHERE workspace_id=$1 AND user_id=$2',[data.workspaceId,i.user_id])).rows[0];if(existing?.active)throw new HttpError(409,'ALREADY_MEMBER');
 if(Number((await db.query('SELECT count(*) FROM memberships WHERE workspace_id=$1 AND active',[data.workspaceId])).rows[0].count)>=w.seat_limit)throw new HttpError(409,'SEAT_LIMIT');
 await db.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role,active=true',[data.workspaceId,i.user_id,invite.role]);await db.query('UPDATE invitations SET accepted_at=now() WHERE id=$1',[invite.id]);await audit(db,data.workspaceId,i.user_id,'invitation.accepted',invite.id);return success;
 }));
 app.get('/api/jobs',authed(async(db,i)=>{requireRole(i.role);return jobMetadata(db,i.workspace_id);}));
 app.get('/api/usage',authed(async(db,i)=>{requireRole(i.role);return usageSummary(db);}));
 app.get('/api/contacts',authed((db,i,req)=>listContacts(db,i,req.query)));
 app.get('/api/contact-tags',authed((db,i)=>listContactTags(db,i)));
 app.get('/api/contacts/export',authed((db,i,req)=>exportContacts(db,i,req.query)));
 app.get('/api/contacts/:id',authed((db,i,req)=>getContact(db,i,String(req.params.id))));
 app.put('/api/contacts/:id',authed((db,i,req)=>updateContact(db,i,String(req.params.id),req.body)));
 app.delete('/api/contacts/:id',authed((db,i,req)=>deleteContact(db,i,String(req.params.id),req.body)));
 app.post('/api/contacts/:id/restore',authed((db,i,req)=>restoreContact(db,i,String(req.params.id),req.body)));
 app.put('/api/contacts/:id/tags',authed((db,i,req)=>setContactTags(db,i,String(req.params.id),req.body)));
 app.post('/api/contacts',authed((db,i,req)=>createContact(db,i,req.body)));
 app.post('/api/contacts/merge',authed((db,i,req)=>mergeContacts(db,i,req.body)));
 app.get('/api/contacts/merge/preview',authed((db,i,req)=>previewMergeContacts(db,i,req.query)));
 app.post('/api/contacts/merge/undo',authed((db,i,req)=>undoMergeContacts(db,i,req.body)));
 app.get('/api/knowledge-categories',authed((db,i)=>listKnowledgeCategories(db,i)));
 app.post('/api/knowledge-categories',authed((db,i,req)=>createKnowledgeCategory(db,i,req.body)));
 app.get('/api/knowledge/items',authed((db,i,req)=>listKnowledge(db,i,req.query)));
 app.get('/api/knowledge/items/:id',authed((db,i,req)=>getKnowledge(db,i,String(req.params.id))));
 app.post('/api/knowledge/items',authed((db,i,req)=>createKnowledge(db,i,req.body)));
 app.post('/api/knowledge/import',authed((db,i,req)=>importKnowledgeBatch(db,i,req.body)));
 app.post('/api/knowledge/import-file',authed((db,i,req)=>importKnowledgeFile(db,i,req.body)));
 app.post('/api/knowledge/import-document',uploadRate,async(req,res,next)=>{try{await transaction(async db=>{const i=await identity(db,req);requireRole(i.role);});next();}catch(error){next(error);}},upload.single('file'),async(req,res)=>{
 const outcome=await transaction(async db=>{const i=await identity(db,req);
  requireRole(i.role);if(!req.file)throw new HttpError(400,'FILE_REQUIRED');
  const requestId=uid.parse(req.get('x-gotek-import-id')||uuid());
  const payload={filename:req.file.originalname,hash:createHash('sha256').update(req.file.buffer).digest('hex'),categoryId:req.body?.categoryId??null};
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`knowledge:${i.workspace_id}:${requestId}`]);
  const old=(await db.query('SELECT operation,payload=$3::jsonb AS same,response FROM knowledge_mutations WHERE workspace_id=$1 AND request_id=$2',[i.workspace_id,requestId,payload])).rows[0];
  if(old){if(old.operation!=='knowledge.document_imported'||!old.same)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return old.response;}
  let extracted;
  try{extracted=await extractDocumentText(req.file.originalname,req.file.buffer);}
  catch(error){
   if(!(error instanceof HttpError))throw error;
   const failed=await beginKnowledgeImport(db,i,{filename:req.file.originalname,mimeType:req.file.mimetype,bytes:req.file.buffer});
   await failKnowledgeImport(db,i,failed.id,error.code);
   const response={error:error.code,httpStatus:error.status,requestId,importId:failed.id};
   await db.query('INSERT INTO knowledge_mutations(workspace_id,request_id,operation,payload,response) VALUES($1,$2,$3,$4,$5)',[i.workspace_id,requestId,'knowledge.document_imported',payload,response]);
   return response;
  }
  const points=Array.from(extracted.content),items=[];
  for(let offset=0;offset<points.length;offset+=2000)items.push({requestId:uuid(),title:Array.from(extracted.filename).slice(0,80).join('')+' · '+(items.length+1),content:points.slice(offset,offset+2000).join(''),categoryId:typeof req.body?.categoryId==='string'?req.body.categoryId:undefined});
  const importedFile=await beginKnowledgeImport(db,i,{filename:req.file.originalname,mimeType:req.file.mimetype,bytes:req.file.buffer});
  const result=await importKnowledgeBatch(db,i,{items});
  const receipt=await completeKnowledgeImport(db,i,importedFile.id,result.imported);
  const response={...result,warnings:extracted.warnings,requestId,importId:receipt.id};
  await db.query('INSERT INTO knowledge_mutations(workspace_id,request_id,operation,payload,response) VALUES($1,$2,$3,$4,$5)',[i.workspace_id,requestId,'knowledge.document_imported',payload,response]);return response;
 });
 if(outcome.error){res.status(outcome.httpStatus).json({error:outcome.error,requestId:outcome.requestId,importId:outcome.importId});return;}
 res.json(outcome);
 });
 app.get('/api/knowledge/imports',authed((db,i,req)=>listKnowledgeImports(db,i,req.query)));
 app.get('/api/knowledge/imports/:id/file',async(req,res)=>{
  const file=await transaction(async db=>getKnowledgeImportFile(db,await identity(db,req),String(req.params.id)));
  res.set('Cache-Control','no-store').attachment(file.filename).type('application/octet-stream').send(file.bytes);
 });
 app.get('/api/knowledge/imports/:id',authed((db,i,req)=>getKnowledgeImport(db,i,String(req.params.id))));
 app.get('/api/knowledge/versions/:versionId/chunks',authed(async(db,i,req)=>{requireRole(i.role);const versionId=uid.parse(req.params.versionId);const query=z.string().trim().min(1).max(500).parse(String(req.query.query||''));const limit=z.coerce.number().int().min(1).max(20).parse(req.query.limit??8);return retrieveStoredChunks(db,i.workspace_id,versionId,query,limit);}));
 app.post('/api/knowledge/import-bytes',express.raw({type:['application/octet-stream','text/plain','text/csv','application/json'],limit:'120kb'}),authed((db,i,req)=>{
  const filename=req.get('x-gotek-filename');
  if(!filename)throw new HttpError(400,'FILENAME_REQUIRED');
  const content=Buffer.isBuffer(req.body)?req.body.toString('utf8'):'';
  return importKnowledgeFile(db,i,{filename,content,categoryId:req.get('x-gotek-category-id')||undefined});
 }));
 app.patch('/api/knowledge/items/:id/draft',authed((db,i,req)=>updateKnowledge(db,i,String(req.params.id),req.body)));
 app.post('/api/knowledge/items/:id/process',authed((db,i,req)=>processKnowledge(db,i,String(req.params.id),req.body)));
 app.post('/api/knowledge/items/:id/publish',authed((db,i,req)=>publishKnowledge(db,i,String(req.params.id),req.body)));
 app.post('/api/knowledge/items/:id/rollback',authed((db,i,req)=>rollbackKnowledge(db,i,String(req.params.id),req.body)));
 app.get('/api/knowledge/retrieve',authed((db,i,req)=>{requireRole(i.role);return retrieveKnowledge(db,i.workspace_id,req.query);}));
 app.get('/api/data-collection',authed((db,i)=>getDataCollectionConfig(db,i)));
 app.put('/api/data-collection',authed((db,i,req)=>saveDataCollectionConfig(db,i,req.body)));
 app.post('/api/data-collection/complete',authed(async(db,i,req)=>completeDataCollection(db,i.workspace_id,req.body)));
 app.get('/api/citations',authed((db,i)=>listCitations(db,i)));
 app.post('/api/citations',authed((db,i,req)=>createCitation(db,i,req.body)));
 app.post('/api/citations/:id/revoke',authed((db,i,req)=>revokeCitation(db,i,String(req.params.id))));
 app.get('/api/onboarding/sources',authed((db,i)=>listOnboardingSources(db,i)));
 app.post('/api/onboarding/sources',authed((db,i,req)=>createOnboardingSource(db,i,req.body)));
 app.post('/api/onboarding/sources/:id/ready',authed((db,i,req)=>setOnboardingReady(db,i,String(req.params.id))));
 app.get('/api/web-sources/:id/schedule',authed((db,i,req)=>readSchedule(db,i,String(req.params.id))));
 app.patch('/api/web-sources/:id/schedule',authed((db,i,req)=>setSchedule(db,i,String(req.params.id),req.body)));
 app.get('/api/web-sources',authed((db,i)=>listWebSources(db,i)));
 app.post('/api/web-sources',authed((db,i,req)=>createWebSource(db,i,req.body)));
 app.patch('/api/web-sources/:id/status',authed((db,i,req)=>setWebSourceStatus(db,i,String(req.params.id),req.body)));
 app.get('/api/web-sources/:id/snapshots',authed((db,i,req)=>listWebSourceSnapshots(db,i,String(req.params.id))));
 app.get('/api/web-sources/:id/snapshots/:snapshotId',authed((db,i,req)=>readWebSourceSnapshot(db,i,String(req.params.id),String(req.params.snapshotId))));
 app.post('/api/web-sources/generations',authed((db,i,req)=>createWebGeneration(db,i,req.body)));
 app.post('/api/web-sources/generations/:generationId/publish',authed((db,i,req)=>publishWebGeneration(db,i,String(req.params.generationId),req.body)));
 app.post('/api/web-sources/generations/:generationId/rollback',authed((db,i,req)=>rollbackWebGeneration(db,i,String(req.params.generationId),req.body)));
 app.post('/api/web-sources/:id/snapshots/:snapshotId/knowledge-drafts',authed((db,i,req)=>importWebSnapshotKnowledge(db,i,String(req.params.id),String(req.params.snapshotId),req.body)));
 app.post('/api/web-sources/:id/snapshots/:snapshotId/generation-draft',authed((db,i,req)=>stageWebSnapshotGeneration(db,i,String(req.params.id),String(req.params.snapshotId),req.body)));
 app.post('/api/web-sources/:id/refresh',authed((db,i,req)=>requestWebSourceRefresh(db,i,String(req.params.id),req.body)));
 app.post('/api/web-sources/:id/preview',authed((db,i,req)=>previewWebSource(db,i,String(req.params.id))));
 app.get('/api/ai/rules',authed((db,i,req)=>listRules(db,i,req.query)));
 app.post('/api/ai/rules',authed((db,i,req)=>createRule(db,i,req.body)));
 app.patch('/api/ai/rules/:id',authed((db,i,req)=>updateRule(db,i,String(req.params.id),req.body)));
 app.patch('/api/ai/rules/:id/state',authed((db,i,req)=>setRuleState(db,i,String(req.params.id),req.body)));
 app.get('/api/ai/rules/export',authed((db,i)=>exportRules(db,i)));
 app.post('/api/ai/rules/import',authed((db,i,req)=>importRules(db,i,req.body)));
 app.get('/api/audit/export',authed((db,i,req)=>exportAuditEvents(db,i,req.query)));
 app.get('/api/audit',authed((db,i,req)=>listAuditEvents(db,i,req.query)));
 app.get('/api/support-grants',authed((db,i)=>listSupport(db,i)));
 app.post('/api/support-grants',authed((db,i,req)=>createSupport(db,i,req.body)));
 app.post('/api/support-grants/:id/revoke',authed((db,i,req)=>revokeSupport(db,i,String(req.params.id))));
  app.get('/api/channels',authed((db,i)=>listChannels(db,i)));
  app.get('/api/channels/:id/installation',authed((db,i,req)=>channelInstallation(db,i,String(req.params.id))));
  app.get('/api/channels/:id/settings',authed((db,i,req)=>channelSettings(db,i,String(req.params.id))));
  app.patch('/api/channels/:id/settings',authed((db,i,req)=>updateChannelSettings(db,i,String(req.params.id),req.body)));
  app.get('/api/channels/:id/agents',authed((db,i,req)=>channelAgents(db,i,String(req.params.id))));
  app.put('/api/channels/:id/agents',authed((db,i,req)=>updateChannelAgents(db,i,String(req.params.id),req.body)));
  app.patch('/api/channels/:id/state',authed((db,i,req)=>updateChannelState(db,i,String(req.params.id),req.body)));
 app.post('/api/channels',authed((db,i,req)=>createChannel(db,i,req.body)));
 app.get('/api/conversations',authed((db,i,req)=>inboxList(db,i,req.query)));
 app.get('/api/conversations/:id/messages',authed((db,i,req)=>inboxMessages(db,i,String(req.params.id),req.query.after)));
 app.post('/api/conversations/:id/resume-ai',authed((db,i,req)=>inboxResumeAi(db,i,String(req.params.id),req.body)));
 app.post('/api/conversations/:id/takeover',authed((db,i,req)=>inboxTakeover(db,i,String(req.params.id),req.body)));
 app.post('/api/conversations/:id/messages',authed((db,i,req)=>inboxSend(db,i,String(req.params.id),req.body)));
 app.patch('/api/conversations/:id/status',authed((db,i,req)=>inboxSetStatus(db,i,String(req.params.id),req.body)));
 platformRoutes(app);
 app.use('/api',(_req,_res,next)=>next(new HttpError(404,'NOT_FOUND')));
 app.use((error:any,_req:Request,res:Response,_next:NextFunction)=>{
 if(error instanceof multer.MulterError)return res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code});
 if(error instanceof z.ZodError)return res.status(400).json({error:'VALIDATION',fields:error.flatten().fieldErrors});
 if(error instanceof HttpError)return res.status(error.status).json({error:error.code});
 if(error.code==='23505')return res.status(409).json({error:'CONFLICT'});
 if(error.type==='entity.parse.failed')return res.status(400).json({error:'INVALID_JSON'});
 console.error(JSON.stringify({event:'request.error',code:error.code||'INTERNAL'}));return res.status(500).json({error:'INTERNAL'});
 });return app;
}
