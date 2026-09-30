import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {aiReplyHandler} from '../src/modules/ai/ai-reply-worker';
import {workspacePrompt} from '../src/modules/ai/workspace-prompt';
import {estimateTokens} from '../src/modules/ai/token-metering';

test('worker estimates the complete grounded prompt and preserves provider receipts', async()=>{
 for(const scenario of [{reported:undefined,revoked:false},{reported:{prompt_tokens:71,completion_tokens:9},revoked:false},{reported:undefined,revoked:true}]){
  const {reported,revoked}=scenario;
  const workspace=randomUUID(),conversation=randomUUID();
  const rules=[{id:randomUUID(),version:1,title:'Tone',content:'Answer concisely'}];
  const history=[{role:'visitor',content:'Which warranty applies?'}];
  let ledger:any;
  const db:any={query:async(sql:string,params:any[]=[])=>{
   let rows:any[]=[];
   if(sql.includes("current_setting('app.workspace_id'"))rows=[{workspace_id:workspace}];
   else if(sql.includes('SELECT id,version,title,content FROM ai_rules'))rows=rules;
   else if(sql.includes('SELECT author_type AS role'))rows=[...history];
   else if(sql.includes('SELECT c.reply_owner'))rows=[{reply_owner:'AI_ACTIVE',owner_version:1,body:'warranty'}];
   else if(sql.includes('SELECT m.id, p.id'))rows=[{id:'model',provider_id:'provider'}];
   else if(sql.includes('SELECT i.id AS item_id'))rows=[{item_id:randomUUID(),published_version_id:randomUUID(),title:'Warranty',content:'Warranty is valid for twelve months. '.repeat(30),audience:'PUBLIC'}];
   else if(sql.includes('SELECT v.id FROM knowledge_items'))rows=revoked?[]:params[1].map((id:string)=>({id}));
   else if(sql.includes('SELECT 1 FROM model_grants'))rows=[{}];
   else if(sql.includes('SELECT * FROM conversations'))rows=[{id:conversation,reply_owner:'AI_ACTIVE',owner_version:1,next_sequence:2}];
   else if(sql.includes('INSERT INTO ai_usage_ledger')){
    ledger={provider:params[2],model:params[3],prompt_tokens:params[4],completion_tokens:params[5],total_tokens:params[6],cost_micros:params[7],estimated:params[8]};rows=[ledger];
   }
   return {rows,rowCount:rows.length};
  }};
  let prompt='';
  const run=()=>aiReplyHandler(db,async input=>{prompt=workspacePrompt(input.message,input.context,input.history,input.rules);return {text:'Twelve months [1]',usage:reported};})({workspace_id:workspace,payload:{conversationId:conversation,messageId:randomUUID(),ownerVersion:1}});
  if(revoked){await assert.rejects(run(),{code:'AI_KNOWLEDGE_REVOKED'});assert.equal(ledger,undefined);continue;}
  await run();
  assert.equal(ledger.prompt_tokens,reported?71:estimateTokens(prompt));
  assert.equal(ledger.estimated,!reported);
  assert.ok(estimateTokens(prompt)>estimateTokens('warranty')*100);
 }
});
