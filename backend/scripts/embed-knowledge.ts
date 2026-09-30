import {z} from 'zod';
import {pool} from '../src/core/db';
import {embedKnowledgeBatch} from '../src/modules/knowledge/knowledge-embedding-worker';
import {HttpError} from '../src/core/security';

try{
 if(process.env.NODE_ENV==='production')throw new HttpError(403,'PRODUCTION_NOT_APPROVED');
 const input=z.object({workspace:z.string().uuid(),versionId:z.string().uuid(),modelId:z.string().uuid(),limit:z.coerce.number().int().min(1).max(100).default(20)}).parse({
  workspace:process.env.GOTEK_WORKER_WORKSPACE,
  versionId:process.env.GOTEK_KNOWLEDGE_VERSION,
  modelId:process.env.GOTEK_EMBEDDING_MODEL,
  limit:process.env.GOTEK_EMBEDDING_BATCH_SIZE,
 });
 const result=await embedKnowledgeBatch(input);
 console.log(JSON.stringify({worker:'knowledge.embedding',state:'completed',stored:result.stored}));
}catch(error){
 // No raw provider response, input, secret, or database detail in operator logs.
 const code=error instanceof HttpError?error.code:error instanceof z.ZodError?'INVALID_WORKER_CONFIGURATION':'EMBEDDING_BATCH_FAILED';
 console.error(JSON.stringify({worker:'knowledge.embedding',state:'failed',code}));
 process.exitCode=1;
}finally{await pool.end();}
