import type {PoolClient} from 'pg';
import {HttpError,uuid} from '../../core/security';
export async function reserveUsage(db:PoolClient,workspace:string,budgetId:string,key:string,units:number){
 if(!Number.isSafeInteger(units)||units<=0||!key||key.length>200)throw new HttpError(400,'INVALID_USAGE');
 const budget=(await db.query('SELECT * FROM quota_budgets WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[budgetId,workspace])).rows[0];
 if(!budget)throw new HttpError(403,'NO_ENTITLEMENT');
 const previous=(await db.query('SELECT * FROM usage_operations WHERE workspace_id=$1 AND operation_key=$2',[workspace,key])).rows[0];
 if(previous){if(previous.budget_id!==budgetId||Number(previous.reserved_units)!==units)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');return previous;}
 const active=(await db.query('SELECT 1 FROM quota_budgets WHERE id=$1 AND period_start<=now() AND period_end>now()',[budgetId])).rowCount;
 if(!active)throw new HttpError(409,'QUOTA_PERIOD_CLOSED');
 const consumed=(await db.query("SELECT coalesce(sum(CASE WHEN state='confirmed' THEN actual_units WHEN state IN ('reserved','unknown') THEN reserved_units ELSE 0 END),0)::text AS units FROM usage_operations WHERE budget_id=$1",[budgetId])).rows[0].units;
 if(BigInt(consumed)+BigInt(units)>BigInt(budget.limit_units))throw new HttpError(409,'QUOTA_EXCEEDED');
 return (await db.query("INSERT INTO usage_operations(id,workspace_id,budget_id,operation_key,reserved_units,state) VALUES($1,$2,$3,$4,$5,'reserved') RETURNING *",[uuid(),workspace,budgetId,key,units])).rows[0];
}
/** Reserve one billable AI response for a workspace.
 *
 * Workspaces that have never been provisioned with an AI-response budget keep
 * the legacy unlimited behaviour. Once a budget exists, however, an expired
 * (or not-yet-started) period is closed: silently falling back to unlimited at
 * a period boundary would bypass the entitlement that was configured for that
 * workspace. The caller can provision/renew the next period and retry with
 * the same idempotency key.
 */
export async function reserveAiResponse(db:PoolClient,workspace:string,key:string){
 // Serialize the operation identity across budget periods, not only within a budget.
 await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`ai-quota:${workspace}:${key}`]);
 const previous=(await db.query("SELECT o.*,b.meter FROM usage_operations o JOIN quota_budgets b ON b.id=o.budget_id AND b.workspace_id=o.workspace_id WHERE o.workspace_id=$1 AND o.operation_key=$2",[workspace,key])).rows[0];
 if(previous){
  if(previous.meter!=='ai_response'||Number(previous.reserved_units)!==1)throw new HttpError(409,'IDEMPOTENCY_CONFLICT');
  return reserveUsage(db,workspace,String(previous.budget_id),key,1);
 }
 const budget=(await db.query("SELECT id FROM quota_budgets WHERE workspace_id=$1 AND meter='ai_response' AND period_start<=now() AND period_end>now() ORDER BY period_start DESC LIMIT 1",[workspace])).rows[0];
 if(!budget){
  const provisioned=(await db.query("SELECT 1 FROM quota_budgets WHERE workspace_id=$1 AND meter='ai_response' LIMIT 1",[workspace])).rowCount;
  if(provisioned)throw new HttpError(409,'QUOTA_PERIOD_CLOSED');
  return undefined;
 }
 return reserveUsage(db,workspace,String(budget.id),key,1);
}
export async function settleUsage(db:PoolClient,workspace:string,id:string,state:'unknown'|'confirmed'|'released',actual?:number,receipt?:string){
 if(state!=='unknown'&&(!receipt||receipt.length>200||!Number.isSafeInteger(actual)||actual!<0||(state==='released'&&actual!==0)))throw new HttpError(400,'INVALID_RECEIPT');
 const target=(await db.query('SELECT budget_id FROM usage_operations WHERE id=$1 AND workspace_id=$2',[id,workspace])).rows[0];if(!target)throw new HttpError(404,'NOT_FOUND');
 await db.query('SELECT id FROM quota_budgets WHERE id=$1 FOR UPDATE',[target.budget_id]);
 const op=(await db.query('SELECT * FROM usage_operations WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[id,workspace])).rows[0];if(!op)throw new HttpError(404,'NOT_FOUND');
 if(['confirmed','released'].includes(op.state)){if(op.state===state&&Number(op.actual_units)===actual&&op.receipt_id===receipt)return op;throw new HttpError(409,'RECEIPT_CONFLICT');}
 return (await db.query('UPDATE usage_operations SET state=$1,actual_units=$2,receipt_id=$3,updated_at=now() WHERE id=$4 RETURNING *',[state,state==='unknown'?null:actual,state==='unknown'?null:receipt,id])).rows[0];
}
export async function usageSummary(db:PoolClient){return (await db.query(`SELECT b.id,b.meter,b.period_start,b.period_end,b.limit_units,
 coalesce(sum(o.actual_units) FILTER(WHERE o.state='confirmed'),0)::text confirmed,
 coalesce(sum(o.reserved_units) FILTER(WHERE o.state='reserved'),0)::text reserved,
 coalesce(sum(o.reserved_units) FILTER(WHERE o.state='unknown'),0)::text unknown
 FROM quota_budgets b LEFT JOIN usage_operations o ON o.budget_id=b.id GROUP BY b.id ORDER BY b.period_start DESC,b.meter`)).rows;}
