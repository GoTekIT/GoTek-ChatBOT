import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
test('embedding CLI rejects production and missing selectors without exposing configuration',async()=>{
 for(const mode of ['production','test']){
  const env:any={...process.env,NODE_ENV:mode};
  delete env.GOTEK_WORKER_WORKSPACE;delete env.GOTEK_KNOWLEDGE_VERSION;delete env.GOTEK_EMBEDDING_MODEL;
  try{await exec(process.execPath,['--import','tsx','scripts/embed-knowledge.ts'],{env,timeout:10000});assert.fail('must reject');}
  catch(error:any){assert.equal(error.code,1);assert.equal(error.stdout,'');assert.deepEqual(JSON.parse(error.stderr),{worker:'knowledge.embedding',state:'failed',code:mode==='production'?'PRODUCTION_NOT_APPROVED':'INVALID_WORKER_CONFIGURATION'});}
 }
});
