import type {PoolClient} from 'pg';import {z} from 'zod';import {uuid,opaque,requireRole,HttpError,audit} from '../../core/security';
 type Actor={workspace_id:string,user_id:string,role:string};
 const databaseId=z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export function websiteOrigin(value:string){let url:URL;try{url=new URL(value);}catch{throw new HttpError(400,'INVALID_WEBSITE_ORIGIN');}if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw new HttpError(400,'INVALID_WEBSITE_ORIGIN');return url.origin;}
 export async function createChannel(db:PoolClient,actor:Actor,body:unknown){requireRole(actor.role);const input=z.object({requestId:z.string().uuid(),name:z.string().trim().min(2).max(100),origin:z.string().max(500),greeting:z.string().trim().min(1).max(500),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),agents:z.array(databaseId).min(1).max(100)}).strict().parse(body);const payload={...input,origin:websiteOrigin(input.origin),agents:[...new Set(input.agents)].sort()};
 await db.query('SELECT id FROM workspaces WHERE id=$1 FOR UPDATE',[actor.workspace_id]);
 const previous=(await db.query('SELECT id,request_payload=$3::jsonb AS same FROM channels WHERE workspace_id=$1 AND request_id=$2',[actor.workspace_id,input.requestId,payload])).rows[0];if(previous){if(!previous.same)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return {id:previous.id};}
 const active=(await db.query('SELECT user_id FROM memberships WHERE workspace_id=$1 AND active AND user_id=ANY($2::uuid[]) FOR SHARE',[actor.workspace_id,payload.agents])).rowCount;if(active!==payload.agents.length)throw new HttpError(400,'INVALID_CHANNEL_MEMBER');
 const key=uuid();await db.query('INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[key,actor.workspace_id,payload.name,payload.origin,payload.greeting,payload.color,opaque(),input.requestId,payload]);
 for(const user of payload.agents)await db.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[actor.workspace_id,key,user]);await audit(db,actor.workspace_id,actor.user_id,'channel.created',key);return {id:key};}
export async function listChannels(db:PoolClient,actor:Actor){return (await db.query(`SELECT c.id,c.name,c.origin,c.greeting,c.color,c.enabled FROM channels c WHERE c.workspace_id=$1 AND ($2::boolean OR EXISTS(SELECT 1 FROM channel_members m WHERE m.channel_id=c.id AND m.user_id=$3)) ORDER BY c.created_at`,[actor.workspace_id,['Owner','Admin'].includes(actor.role),actor.user_id])).rows;}
export async function channelInstallation(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role); const row=(await db.query('SELECT id,name,origin,public_key,color,widget_title,widget_position,enabled FROM channels WHERE id=$1 AND workspace_id=$2',[id,actor.workspace_id])).rows[0];
 if(!row) throw new HttpError(404,'CHANNEL_NOT_FOUND');
 const rawBase = (process.env.APP_ORIGIN || 'http://127.0.0.1:4317').split(',')[0].trim();
 const base = (rawBase || 'http://127.0.0.1:4317').replace(/\/$/, '');
 const customerBase=(process.env.PUBLIC_APP_ORIGIN||process.env.FRONTEND_ORIGIN||'http://localhost:3001').replace(/\/$/,'');
 const esc=(v:any)=>JSON.stringify(v).replace(/</g,'\\u003c');
 const colorVal = row.color || '#0057e1';
 const titleVal = row.widget_title || row.name || 'Chat với chúng tôi';
 const nameVal = row.name || 'GoTek';
 const posVal = row.widget_position || 'right';
 const snippet = `<!-- GoTek Chatbot Widget (Async Loader - Khuyên dùng) -->\n<script>\n  (function(g,o,t,e,k){g.GoTekObject=t;g[t]=g[t]||function(){(g[t].q=g[t].q||[]).push(arguments)};var s=o.createElement('script');s.async=1;s.src=e;var f=o.getElementsByTagName('script')[0];f.parentNode.insertBefore(s,f);})(window,document,'gotekSDK',${esc(base+'/sdk.js')});\n  window.gotekSDK('run',{\n    websiteToken: ${esc(row.public_key)},\n    baseUrl: ${esc(base)},\n    name: ${esc(nameVal)},\n    widgetTitle: ${esc(titleVal)},\n    color: ${esc(colorVal)},\n    widgetPosition: ${esc(posVal)},\n    autoOpen: false\n  });\n</script>`;
 const snippetStandard = `<!-- GoTek Chatbot Widget (Standard Script) -->\n<script\n  src="${base}/sdk.js"\n  data-website-token="${row.public_key}"\n  data-base-url="${base}"\n  data-name="${nameVal}"\n  data-widget-title="${titleVal}"\n  data-color="${colorVal}"\n  data-widget-position="${posVal}"\n  data-auto-open="false"\n  async>\n</script>`;
 const snippetNextJs = `import Script from 'next/script';\n\n{/* Chèn vào file src/app/layout.tsx trước thẻ đóng </body> */}\n<Script\n  id="gotek-chatbot"\n  src="${base}/sdk.js"\n  data-website-token="${row.public_key}"\n  data-base-url="${base}"\n  data-name="${nameVal}"\n  data-widget-title="${titleVal}"\n  data-color="${colorVal}"\n  data-widget-position="${posVal}"\n  data-auto-open="false"\n  strategy="afterInteractive"\n/>`;
 const snippetReact = `import { useEffect } from 'react';\n\n// Hook nhúng GoTek Chatbot Widget cho React SPA\nexport function useGotekChatbot() {\n  useEffect(() => {\n    const s = document.createElement('script');\n    s.id = 'gotek-chatbot-sdk';\n    s.src = '${base}/sdk.js';\n    s.async = true;\n    s.setAttribute('data-website-token', '${row.public_key}');\n    s.setAttribute('data-base-url', '${base}');\n    s.setAttribute('data-name', '${nameVal}');\n    s.setAttribute('data-widget-title', '${titleVal}');\n    s.setAttribute('data-color', '${colorVal}');\n    s.setAttribute('data-widget-position', '${posVal}');\n    s.setAttribute('data-auto-open', 'false');\n    document.body.appendChild(s);\n    return () => { s.remove(); };\n  }, []);\n}`;
 return {id:row.id,name:row.name,origin:row.origin,color:colorVal,widgetTitle:titleVal,widgetPosition:posVal,enabled:row.enabled,publicKey:row.public_key,snippet,snippetStandard,snippetNextJs,snippetReact};
}
export async function verifyChannelInstallation(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role);
 const row=(await db.query('SELECT id,name,origin,public_key,enabled FROM channels WHERE id=$1 AND workspace_id=$2',[id,actor.workspace_id])).rows[0];
 if(!row) throw new HttpError(404,'CHANNEL_NOT_FOUND');
 const visitorCount = Number((await db.query('SELECT count(*) as total FROM visitors WHERE channel_id=$1 AND workspace_id=$2',[id,actor.workspace_id])).rows[0]?.total || 0);
 const lastActive = (await db.query('SELECT max(created_at) as last_seen FROM conversations WHERE channel_id=$1 AND workspace_id=$2',[id,actor.workspace_id])).rows[0]?.last_seen || null;
 return {
  channelId: row.id,
  origin: row.origin,
  enabled: row.enabled,
  hasSessions: visitorCount > 0,
  visitorCount,
  lastActiveAt: lastActive,
  status: !row.enabled ? 'disabled' : (visitorCount > 0 ? 'connected' : 'waiting')
 };
}
export async function channelSettings(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role); const row=(await db.query(`SELECT c.id, c.name, c.origin, c.greeting, c.color, c.assignment_enabled, c.assignment_limit, c.business_hours, c.prechat, c.widget_title, c.widget_position, c.widget_mode, coalesce((SELECT json_agg(cm.user_id) FROM channel_members cm WHERE cm.channel_id=c.id AND cm.workspace_id=c.workspace_id), '[]'::json) AS agents FROM channels c WHERE c.id=$1 AND c.workspace_id=$2`,[id,actor.workspace_id])).rows[0];
 if(!row) throw new HttpError(404,'CHANNEL_NOT_FOUND'); return row;
}
export async function updateChannelSettings(db:PoolClient,actor:Actor,id:string,body:unknown){
 requireRole(actor.role); const fieldKey=z.string().regex(/^[a-z][a-zA-Z0-9_]{1,39}$/).refine((key)=>!['__proto__','constructor','prototype'].includes(key),'INVALID_PRECHAT_FIELD_KEY'); const field=z.object({key:fieldKey,enabled:z.boolean(),required:z.boolean(),label:z.string().trim().min(1).max(120),placeholder:z.string().max(160)}).strict();
 const input=z.object({
   name:z.string().trim().min(2).max(100).optional(),
   origin:z.string().max(500).optional(),
   greeting:z.string().trim().min(1).max(500).optional(),
   assignmentEnabled:z.boolean().optional(),
   assignmentLimit:z.number().int().min(1).max(10000).nullable().optional(),
   businessHours:z.object({enabled:z.boolean(),timezone:z.string().min(1).max(80),days:z.array(z.object({day:z.number().int().min(0).max(6),enabled:z.boolean(),fullDay:z.boolean(),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).strict()).max(7)}).strict().optional(),
   prechat:z.object({enabled:z.boolean(),message:z.string().max(500),fields:z.array(field).min(1).max(10)}).strict().optional(),
   widgetTitle:z.string().trim().min(1).max(80).optional(),
   widgetPosition:z.enum(['left','right']).optional(),
   widgetMode:z.enum(['standard','expanded']).optional(),
   color:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
   widgetColor:z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
   agents:z.array(databaseId).min(1).max(100).optional()
 }).strict().parse(body);
 if(input.businessHours){
   try{new Intl.DateTimeFormat('en-US',{timeZone:input.businessHours.timezone}).format();}catch{throw new HttpError(400,'INVALID_TIMEZONE');}
   if(new Set(input.businessHours.days.map(d=>d.day)).size!==input.businessHours.days.length)throw new HttpError(400,'INVALID_BUSINESS_HOURS');
 }
 if(input.prechat){
   const keys=input.prechat.fields.map(f=>f.key);if(new Set(keys).size!==keys.length)throw new HttpError(400,'DUPLICATE_PRECHAT_FIELD');
   if(input.prechat.fields.some(f=>!f.enabled&&f.required))throw new HttpError(400,'INVALID_PRECHAT_REQUIRED');
 }
 const cleanOrigin=input.origin ? websiteOrigin(input.origin) : undefined;
 await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,actor.workspace_id]);
 if(input.agents){
   const agents=[...new Set(input.agents)];
   const valid=(await db.query('SELECT user_id FROM memberships WHERE workspace_id=$1 AND active AND user_id=ANY($2::uuid[]) FOR SHARE',[actor.workspace_id,agents])).rows.map(r=>r.user_id);
   if(valid.length!==agents.length)throw new HttpError(400,'INVALID_CHANNEL_MEMBER');
   const previous=(await db.query('SELECT user_id FROM channel_members WHERE workspace_id=$1 AND channel_id=$2',[actor.workspace_id,id])).rows.map(r=>r.user_id);
   const removed=previous.filter((user)=>!agents.includes(user));
   await db.query('DELETE FROM channel_members WHERE workspace_id=$1 AND channel_id=$2',[actor.workspace_id,id]);
   for(const user of agents)await db.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3)',[actor.workspace_id,id,user]);
   if(removed.length){
     await db.query("UPDATE conversations SET assigned_to=NULL,reply_owner='HANDOFF_PENDING',owner_version=owner_version+1,updated_at=now() WHERE workspace_id=$1 AND channel_id=$2 AND status='open' AND assigned_to=ANY($3::uuid[])",[actor.workspace_id,id,removed]);
     await audit(db,actor.workspace_id,actor.user_id,'channel.assignments.released',id);
   }
   await audit(db,actor.workspace_id,actor.user_id,'channel.members.updated',id);
 }
 const targetColor=input.color||input.widgetColor;
 const row=(await db.query('UPDATE channels SET name=coalesce($1,name),origin=coalesce($2,origin),greeting=coalesce($3,greeting),color=coalesce($4,color),assignment_enabled=coalesce($5,assignment_enabled),assignment_limit=case when $6::boolean then $7 else assignment_limit end,business_hours=coalesce($8,business_hours),prechat=coalesce($9,prechat),widget_title=coalesce($10,widget_title),widget_position=coalesce($11,widget_position),widget_mode=coalesce($12,widget_mode) WHERE id=$13 AND workspace_id=$14 RETURNING id,name,origin,greeting,color,assignment_enabled,assignment_limit,business_hours,prechat,widget_title,widget_position,widget_mode',[input.name,cleanOrigin,input.greeting,targetColor,input.assignmentEnabled,input.assignmentLimit!==undefined,input.assignmentLimit,input.businessHours,input.prechat,input.widgetTitle,input.widgetPosition,input.widgetMode,id,actor.workspace_id])).rows[0];
 if(!row) throw new HttpError(404,'CHANNEL_NOT_FOUND'); await audit(db,actor.workspace_id,actor.user_id,'channel.assignment.updated',id); return row;
}
export async function channelAgents(db:PoolClient,actor:Actor,id:string){
 requireRole(actor.role); if(!(await db.query('SELECT id FROM channels WHERE id=$1 AND workspace_id=$2',[id,actor.workspace_id])).rowCount)throw new HttpError(404,'CHANNEL_NOT_FOUND');
 return (await db.query('SELECT u.id,u.email,u.full_name,m.role FROM channel_members cm JOIN memberships m ON m.workspace_id=cm.workspace_id AND m.user_id=cm.user_id AND m.active JOIN users u ON u.id=cm.user_id WHERE cm.workspace_id=$1 AND cm.channel_id=$2 ORDER BY u.full_name',[actor.workspace_id,id])).rows;
}
export async function updateChannelAgents(db:PoolClient,actor:Actor,id:string,body:unknown){
  requireRole(actor.role); const data=z.object({agents:z.array(databaseId).min(1).max(100)}).strict().parse(body); const agents=[...new Set(data.agents)];
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
