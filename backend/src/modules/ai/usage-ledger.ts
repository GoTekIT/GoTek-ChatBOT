import type {PoolClient} from 'pg';
import {z} from 'zod';
import {HttpError} from '../../core/security';
import type {TokenMeterEvent} from './token-metering';

const event=z.object({workspaceId:z.string().uuid(),operationKey:z.string().trim().min(1).max(180),provider:z.string().trim().min(1).max(80),model:z.string().trim().min(1).max(180),usage:z.object({promptTokens:z.number().int().nonnegative(),completionTokens:z.number().int().nonnegative(),totalTokens:z.number().int().nonnegative(),estimated:z.boolean()}),costMicros:z.bigint().nonnegative()}).strict();

/** Idempotent tenant-scoped receipt. A retry returns the original row. */
export async function recordUsage(db:PoolClient,event:TokenMeterEvent){
 const parsed=eventSchema.parse(event);
 const row=await db.query(`INSERT INTO ai_usage_ledger(workspace_id,operation_key,provider,model,prompt_tokens,completion_tokens,total_tokens,cost_micros,estimated) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,operation_key) DO NOTHING RETURNING *`,[parsed.workspaceId,parsed.operationKey,parsed.provider,parsed.model,parsed.usage.promptTokens,parsed.usage.completionTokens,parsed.usage.totalTokens,parsed.costMicros,parsed.usage.estimated]);
 const receipt=row.rows[0]??(await db.query('SELECT * FROM ai_usage_ledger WHERE workspace_id=$1 AND operation_key=$2',[parsed.workspaceId,parsed.operationKey])).rows[0];
 if(!receipt)throw new HttpError(409,'USAGE_RECEIPT_UNAVAILABLE');
 if(receipt.provider!==parsed.provider||receipt.model!==parsed.model||String(receipt.prompt_tokens)!==String(parsed.usage.promptTokens)||String(receipt.completion_tokens)!==String(parsed.usage.completionTokens)||String(receipt.total_tokens)!==String(parsed.usage.totalTokens)||String(receipt.cost_micros)!==String(parsed.costMicros)||receipt.estimated!==parsed.usage.estimated)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');
 return receipt;
}

const eventSchema=event;
