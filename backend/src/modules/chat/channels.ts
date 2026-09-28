import type {PoolClient} from 'pg';import {z} from 'zod';import {uuid,opaque,requireRole,HttpError,audit} from '../../core/security';
type Actor={workspace_id:string,user_id:string,role:string};
export function websiteOrigin(value:string){let url:URL;try{url=new URL(value);}catch{throw new HttpError(400,'INVALID_WEBSITE_ORIGIN');}if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new HttpError(400,'INVALID_WEBSITE_ORIGIN');return url.origin;}
export async function createChannel(db:PoolClient,actor:Actor,body:unknown){requireRole(actor.role);const input=z.object({requestId:z.string().uuid(),name:z.string().trim().min(2).max(100),origin:z.string().max(500),greeting:z.string().trim().min(1).max(500),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),agents:z.array(z.string().uuid()).min(1).max(100)}).strict().parse(body);const payload={...input,origin:websiteOrigin(input.origin),agents:[...new Set(input.agents)].sort()};
 await db.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[actor.workspace_id]);
 const previous=(await db.query('SELECT id,request_payload=$3::jsonb AS same FROM channels WHERE workspace_id=$1 AND request_id=$2',[actor.workspace_id,input.requestId,payload])).rows[0];if(previous){if(!previous.same)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return {id:previous.id};}
 const active=(await db.query('SELECT user_id FROM memberships WHERE workspace_id=$1 AND active AND user_id=ANY($2::uuid[]) FOR SHARE',[actor.workspace_id,payload.agents])).rowCount;if(active!==payload.agents.length)throw new HttpError(400,'INVALID_CHANNEL_MEMBER');
 const key=uuid();await db.query('INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[key,actor.workspace_id,payload.name,payload.origin,payload.greeting,payload.color,opaque(),input.requestId,payload]);
 for(const user of payload.agents)await db.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[actor.workspace_id,key,user]);await audit(db,actor.workspace_id,actor.user_id,'channel.created',key);return {id:key};}
export async function listChannels(db:PoolClient,actor:Actor){return (await db.query(`SELECT c.id,c.name,c.origin,c.greeting,c.color,c.enabled FROM channels c WHERE c.workspace_id=$1 AND ($2::boolean OR EXISTS(SELECT 1 FROM channel_members m WHERE m.channel_id=c.id AND m.user_id=$3)) ORDER BY c.created_at`,[actor.workspace_id,['Owner','Admin'].includes(actor.role),actor.user_id])).rows;}
export async function channelInstallation(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role); const row=(await db.query('SELECT id,name,origin,public_key,enabled FROM channels WHERE id=$1 AND workspace_id=$2',[id,actor.workspace_id])).rows[0];
 if(!row) throw new HttpError(404,'CHANNEL_NOT_FOUND');
 const base=(process.env.APP_ORIGIN||'http://127.0.0.1:4317').replace(/\/$/,'');
 const esc=(v:string)=>JSON.stringify(v).replace(/</g,'\\u003c');
 return {id:row.id,name:row.name,origin:row.origin,enabled:row.enabled,publicKey:row.public_key,snippet:`<script src="${base}/sdk.js"></script>\n<script>window.gotekSDK.run({websiteToken:${esc(row.public_key)},baseUrl:${esc(base)}});</script>`};
}
export async function channelSettings(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role); const row=(await db.query('SELECT id,name,assignment_enabled,assignment_limit,business_hours,prechat,widget_title,widget_position,widget_mode FROM channels WHERE id=$1 AND workspace_id=$2',[id,actor.workspace_id])).rows[0];
 if(!row) throw new HttpError(404,'CHANNEL_NOT_FOUND'); return row;
}
export async function updateChannelSettings(db:PoolClient,actor:Actor,id:string,body:unknown){
 requireRole(actor.role); const field=z.object({key:z.enum(['emailAddress','fullName','phoneNumber']),enabled:z.boolean(),required:z.boolean(),label:z.string().trim().min(1).max(120),placeholder:z.string().max(160)}).strict();
 const input=z.object({assignmentEnabled:z.boolean(),assignmentLimit:z.number().int().min(1).max(10000).nullable(),businessHours:z.object({enabled:z.boolean(),timezone:z.string().min(1).max(80),days:z.array(z.object({day:z.number().int().min(0).max(6),enabled:z.boolean(),fullDay:z.boolean(),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).strict()).max(7)}).strict(),prechat:z.object({enabled:z.boolean(),message:z.string().max(500),fields:z.array(field).max(3)}).strict(),widgetTitle:z.string().trim().min(1).max(80).optional(),widgetPosition:z.enum(['left','right']).optional(),widgetMode:z.enum(['standard','expanded']).optional()}).strict().parse(body);
 try{new Intl.DateTimeFormat('en-US',{timeZone:input.businessHours.timezone}).format();}catch{throw new HttpError(400,'INVALID_TIMEZONE');}
 if(new Set(input.businessHours.days.map(d=>d.day)).size!==input.businessHours.days.length)throw new HttpError(400,'INVALID_BUSINESS_HOURS');
 const keys=input.prechat.fields.map(f=>f.key);if(new Set(keys).size!==keys.length)throw new HttpError(400,'DUPLICATE_PRECHAT_FIELD');
 if(input.prechat.fields.some(f=>!f.enabled&&f.required))throw new HttpError(400,'INVALID_PRECHAT_REQUIRED');
 await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,actor.workspace_id]);
 const row=(await db.query('UPDATE channels SET assignment_enabled=$1,assignment_limit=$2,business_hours=$3,prechat=$4,widget_title=coalesce($5,widget_title),widget_position=coalesce($6,widget_position),widget_mode=coalesce($7,widget_mode) WHERE id=$8 AND workspace_id=$9 RETURNING id,assignment_enabled,assignment_limit,business_hours,prechat,widget_title,widget_position,widget_mode',[input.assignmentEnabled,input.assignmentLimit,input.businessHours,input.prechat,input.widgetTitle,input.widgetPosition,input.widgetMode,id,actor.workspace_id])).rows[0];
 if(!row) throw new HttpError(404,'CHANNEL_NOT_FOUND'); await audit(db,actor.workspace_id,actor.user_id,'channel.assignment.updated',id); return row;
}
export async function channelAgents(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role); if(!(await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2',[id,actor.workspace_id])).rowCount)throw new HttpError(404,'CHANNEL_NOT_FOUND');
 return (await db.query('SELECT u.id,u.email,u.full_name,m.role FROM channel_members cm JOIN memberships m ON m.workspace_id=cm.workspace_id AND m.user_id=cm.user_id AND m.active JOIN users u ON u.id=cm.user_id WHERE cm.workspace_id=$1 AND cm.channel_id=$2 ORDER BY u.full_name',[actor.workspace_id,id])).rows;
}
export async function updateChannelAgents(db:PoolClient,actor:Actor,id:string,body:unknown){
 requireRole(actor.role); const data=z.object({agents:z.array(z.string().uuid()).min(1).max(100)}).strict().parse(body); const agents=[...new Set(data.agents)];
 if(!(await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,actor.workspace_id])).rowCount)throw new HttpError(404,'CHANNEL_NOT_FOUND');
 const valid=(await db.query('SELECT user_id FROM memberships WHERE workspace_id=$1 AND active AND user_id=ANY($2::uuid[]) FOR SHARE',[actor.workspace_id,agents])).rows.map(r=>r.user_id);if(valid.length!==agents.length)throw new HttpError(400,'INVALID_CHANNEL_MEMBER');
 const previous=(await db.query('SELECT user_id FROM channel_members WHERE workspace_id=$1 AND channel_id=$2',[actor.workspace_id,id])).rows.map(r=>r.user_id);
 const removed=previous.filter((user:string)=>!agents.includes(user));
 await db.query('DELETE FROM channel_members WHERE workspace_id=$1 AND channel_id=$2',[actor.workspace_id,id]);for(const user of agents)await db.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[actor.workspace_id,id,user]);
 if(removed.length){await db.query("UPDATE conversations SET assigned_to=NULL,reply_owner='HANDOFF_PENDING',owner_version=owner_version+1,updated_at=now() WHERE workspace_id=$1 AND channel_id=$2 AND status='open' AND assigned_to=ANY($3::uuid[])",[actor.workspace_id,id,removed]);await audit(db,actor.workspace_id,actor.user_id,'channel.assignments.released',id);}
 await audit(db,actor.workspace_id,actor.user_id,'channel.members.updated',id);return {agents:valid};
}
export async function updateChannelState(db:PoolClient,actor:Actor,id:string,body:unknown){
 requireRole(actor.role);const data=z.object({enabled:z.boolean()}).strict().parse(body);await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,actor.workspace_id]);const row=(await db.query('UPDATE channels SET enabled=$1 WHERE id=$2 AND workspace_id=$3 RETURNING id,enabled',[data.enabled,id,actor.workspace_id])).rows[0];if(!row)throw new HttpError(404,'CHANNEL_NOT_FOUND');await audit(db,actor.workspace_id,actor.user_id,data.enabled?'channel.enabled':'channel.disabled',id);return row;
}
