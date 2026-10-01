import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {Client} from 'pg';

type FixtureManifest={
 version:1;
 databaseKind:'disposable-test-only';
 createdAt:string;
 workspaceIds:string[];
 userIds:string[];
 channelIds:string[];
 visitorIds:string[];
 conversationIds:string[];
 messageIds:string[];
 workspaces:Record<string,{id:string;origin:string;channelId:string;publicKey:string;roles:Record<string,string>;conversations:Record<string,string>}>;
};

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..','..');
const manifestPath=resolve(process.env.GOTEK_FIXTURE_MANIFEST??resolve(repoRoot,'plan_nguyen/10day/evidence/n1-fixture-manifest.json'));

function databaseUrl(){
 const raw=process.env.GOTEK_FIXTURE_DATABASE_URL;
 if(!raw)throw new Error('REFUSED: set GOTEK_FIXTURE_DATABASE_URL to a disposable test database');
 if(process.env.GOTEK_FIXTURE_DB_KIND!=='disposable-test-only')throw new Error('REFUSED: set GOTEK_FIXTURE_DB_KIND=disposable-test-only');
 const url=new URL(raw);
 if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('REFUSED: fixture URL must use PostgreSQL');
 if(/supabase\.(co|com)|pooler\.supabase\.com/i.test(url.hostname))throw new Error('REFUSED: shared Supabase is not an allowed fixture database');
 return raw;
}

function publicKey(){return randomBytes(32).toString('base64url');}
function tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}

async function seed(){
 if(existsSync(manifestPath))throw new Error('REFUSED: manifest already exists; run --reset first');
 const client=new Client({connectionString:databaseUrl()});
 await client.connect();
 const wsA=randomUUID(),wsB=randomUUID();
 const usersA={owner:randomUUID(),admin:randomUUID(),agent:randomUUID(),outside:randomUUID()};
 const usersB={owner:randomUUID(),agent:randomUUID()};
 const channels={A:randomUUID(),B:randomUUID()};
 const sharedOrigin=process.env.GOTEK_FIXTURE_ORIGIN;
 const origins={A:process.env.GOTEK_FIXTURE_ORIGIN_A??sharedOrigin??'https://fixture-a.example.test',B:process.env.GOTEK_FIXTURE_ORIGIN_B??sharedOrigin??'https://fixture-b.example.test'};
 const keys={A:publicKey(),B:publicKey()};
 const visitors:Record<string,string>={},conversations:Record<string,string>={},messageIds:string[]=[];
 const states=['ai','pending','human','resolved','snoozed'];
 for(const state of states){visitors['A_'+state]=randomUUID();conversations['A_'+state]=randomUUID();}
 visitors.B=randomUUID();conversations.B=randomUUID();
 const allUsers={ownerA:usersA.owner,adminA:usersA.admin,agentA:usersA.agent,outsideA:usersA.outside,ownerB:usersB.owner,agentB:usersB.agent};
 const allWorkspaces=[wsA,wsB],allChannels=[channels.A,channels.B],allVisitors=Object.values(visitors),allConversations=Object.values(conversations);
 try{
  await client.query('BEGIN');
  await client.query('INSERT INTO workspaces(id,name) VALUES($1,$2),($3,$4)',[wsA,'GoTek Workshop Fixture A',wsB,'GoTek Workshop Fixture B']);
  for(const [name,id] of Object.entries(allUsers))await client.query('INSERT INTO users(id,email,full_name,phone,password_hash,verified_at) VALUES($1,$2,$3,$4,$5,now())',[id,'fixture-'+name.toLowerCase()+'-'+id+'@example.test',name,'0900000000','fixture-disabled']);
  await client.query("INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,'Owner'),($1,$3,'Admin'),($1,$4,'Agent'),($1,$5,'Agent'),($6,$7,'Owner'),($6,$8,'Agent')",[wsA,usersA.owner,usersA.admin,usersA.agent,usersA.outside,wsB,usersB.owner,usersB.agent]);
  await client.query("INSERT INTO channels(id,workspace_id,name,origin,greeting,color,public_key,request_id,request_payload) VALUES($1,$2,'Workshop Channel A',$3,'Xin chào','#0057E1',$4,$5,'{}'),($6,$7,'Workshop Channel B',$8,'Xin chào','#0057E1',$9,$10,'{}')",[channels.A,wsA,origins.A,keys.A,randomUUID(),channels.B,wsB,origins.B,keys.B,randomUUID()]);
  await client.query('INSERT INTO channel_members(workspace_id,channel_id,user_id) VALUES($1,$2,$3),($1,$2,$4),($5,$6,$7)',[wsA,channels.A,usersA.agent,usersA.admin,wsB,channels.B,usersB.agent]);
  for(const state of states){
   const conversation=conversations['A_'+state],visitor=visitors['A_'+state],owner=state==='human'||state==='resolved'?usersA.agent:null;
   const status=state==='resolved'?'resolved':state==='snoozed'?'snoozed':'open';
   const replyOwner=state==='ai'?'AI_ACTIVE':state==='human'||state==='resolved'?'HUMAN_ACTIVE':'HANDOFF_PENDING';
   await client.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,profile,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')",[visitor,wsA,channels.A,tokenHash(randomBytes(32).toString('base64url')),JSON.stringify({fullName:'Visitor A '+state,emailAddress:'visitor-'+state+'@fixture.test'})]);
   await client.query('INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,status,reply_owner,assigned_to) VALUES($1,$2,$3,$4,$5,$6,$7)',[conversation,wsA,channels.A,visitor,status,replyOwner,owner]);
   const visitorMessage=randomUUID();messageIds.push(visitorMessage);
   await client.query("INSERT INTO messages(id,workspace_id,conversation_id,client_id,sequence,author_type,visibility,body) VALUES($1,$2,$3,$4,1,'visitor','public',$5)",[visitorMessage,wsA,conversation,randomUUID(),'Fixture question '+state]);
   let next=2;
   if(state==='human'||state==='resolved'){
    const reply=randomUUID(),note=randomUUID();messageIds.push(reply,note);
    await client.query("INSERT INTO messages(id,workspace_id,conversation_id,client_id,sequence,author_type,actor_id,visibility,body) VALUES($1,$2,$3,$4,$5,'agent',$6,'public','Fixture public reply'),($7,$2,$3,$8,$9,'agent',$6,'internal','Fixture internal note')",[reply,wsA,conversation,randomUUID(),next++,usersA.agent,note,randomUUID(),next++]);
   }
   await client.query('UPDATE conversations SET next_sequence=$1 WHERE id=$2',[next,conversation]);
  }
  await client.query("INSERT INTO visitors(id,workspace_id,channel_id,token_hash,profile,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')",[visitors.B,wsB,channels.B,tokenHash(randomBytes(32).toString('base64url')),JSON.stringify({fullName:'Visitor B',emailAddress:'visitor-b@fixture.test'})]);
  await client.query("INSERT INTO conversations(id,workspace_id,channel_id,visitor_id,reply_owner) VALUES($1,$2,$3,$4,'AI_ACTIVE')",[conversations.B,wsB,channels.B,visitors.B]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
 const manifest:FixtureManifest={version:1,databaseKind:'disposable-test-only',createdAt:new Date().toISOString(),workspaceIds:allWorkspaces,userIds:Object.values(allUsers),channelIds:allChannels,visitorIds:allVisitors,conversationIds:allConversations,messageIds,workspaces:{A:{id:wsA,origin:origins.A,channelId:channels.A,publicKey:keys.A,roles:usersA,conversations:{...Object.fromEntries(states.map(state=>[state,conversations['A_'+state]]))}},B:{id:wsB,origin:origins.B,channelId:channels.B,publicKey:keys.B,roles:usersB,conversations:{main:conversations.B}}}};
 mkdirSync(dirname(manifestPath),{recursive:true});writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n',{encoding:'utf8'});console.log('SEEDED manifest='+manifestPath);
}

async function reset(){
 const manifest:FixtureManifest=JSON.parse(readFileSync(manifestPath,'utf8'));
 if(manifest.version!==1||manifest.databaseKind!=='disposable-test-only')throw new Error('REFUSED: invalid or non-disposable manifest');
 const client=new Client({connectionString:databaseUrl()});await client.connect();
 try{
  await client.query('BEGIN');
  await client.query('DELETE FROM messages WHERE id=ANY($1::uuid[])',[manifest.messageIds]);
  await client.query('DELETE FROM conversations WHERE id=ANY($1::uuid[])',[manifest.conversationIds]);
  await client.query('DELETE FROM visitors WHERE id=ANY($1::uuid[])',[manifest.visitorIds]);
  await client.query('DELETE FROM channel_members WHERE channel_id=ANY($1::uuid[])',[manifest.channelIds]);
  await client.query('DELETE FROM channels WHERE id=ANY($1::uuid[])',[manifest.channelIds]);
  await client.query('DELETE FROM audit_events WHERE workspace_id=ANY($1::uuid[])',[manifest.workspaceIds]);
  await client.query('DELETE FROM sessions WHERE workspace_id=ANY($1::uuid[])',[manifest.workspaceIds]);
  await client.query('DELETE FROM jobs WHERE workspace_id=ANY($1::uuid[])',[manifest.workspaceIds]);
  await client.query('DELETE FROM memberships WHERE workspace_id=ANY($1::uuid[])',[manifest.workspaceIds]);
  await client.query('DELETE FROM workspaces WHERE id=ANY($1::uuid[])',[manifest.workspaceIds]);
  await client.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[manifest.userIds]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
 console.log('RESET manifest='+manifestPath);
}

const mode=process.argv[2];
if(mode==='--seed')await seed();
else if(mode==='--reset')await reset();
else throw new Error('Usage: workshop-fixture.ts --seed|--reset');
