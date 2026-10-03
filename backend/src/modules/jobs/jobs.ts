import type { PoolClient } from 'pg';
import { HttpError, uuid } from '../../core/security';
import { publishTask, QUEUES } from '../../core/rabbitmq.js';

type JobInput = { kind: string; key: string; payload: Record<string, unknown>; external: boolean; maxAttempts?: number };
type JobOutcome = { state: 'succeeded'; receipt: string } | { state: 'failed' | 'unknown'; code: string };

function validateJobInput(input: JobInput, attempts: number): void {
  const payloadSize = JSON.stringify(input.payload).length;
  if (!/^[a-z][a-z0-9._-]{0,79}$/.test(input.kind) || !input.key || input.key.length > 200 || !Number.isInteger(attempts) || attempts < 1 || attempts > 10 || payloadSize > 64000) throw new HttpError(400, 'INVALID_JOB');
}

export async function enqueueJob(db: PoolClient, workspace: string, input: JobInput) {
  const attempts = input.maxAttempts ?? 5;
  validateJobInput(input, attempts);
  const inserted = await db.query(`INSERT INTO jobs (id, workspace_id, kind, idempotency_key, payload, external_effect, max_attempts) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (workspace_id,idempotency_key) DO NOTHING RETURNING *`, [uuid(), workspace, input.kind, input.key, input.payload, input.external, attempts]);

  if (inserted.rowCount) {
    const job = inserted.rows[0];
    // Publish to RabbitMQ for event-driven asynchronous processing
    let targetQueue: string | null = null;
    if (input.kind === 'ai.reply') targetQueue = QUEUES.AI_REPLY;
    else if (input.kind === 'knowledge.embed') targetQueue = QUEUES.KNOWLEDGE_EMBED;
    else if (input.kind === 'web.crawl' || input.kind === 'web.refresh') targetQueue = QUEUES.WEB_CRAWL;

    if (targetQueue) {
      void publishTask(targetQueue, {
        workspace,
        jobId: job.id,
        kind: input.kind,
        key: input.key,
        payload: input.payload
      }).then(() => {
        console.log(`[RabbitMQ] 📤 Published job "${input.kind}" (${job.id}) to queue "${targetQueue}"`);
      }).catch(err => {
        console.warn(`[RabbitMQ] ⚠️ Failed to publish to ${targetQueue}:`, err?.message || err);
      });
    }

    return job;
  }

  const previous = (await db.query('SELECT *, payload=$3::jsonb AS same_payload FROM jobs WHERE workspace_id=$1 AND idempotency_key=$2', [workspace, input.key, input.payload])).rows[0];
  if (!previous || previous.kind !== input.kind || !previous.same_payload || previous.external_effect !== input.external || previous.max_attempts !== attempts) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT');
  return previous;
}

export async function recoverStaleJobs(db: PoolClient) {
  const result = await db.query(`UPDATE jobs SET state=CASE WHEN external_effect THEN 'unknown' WHEN attempts>=max_attempts THEN 'dead' ELSE 'retry' END, available_at=now()+make_interval(secs=>LEAST(300,power(2,attempts)::int)), lease_token=NULL, lease_until=NULL, error_code='LEASE_EXPIRED', updated_at=now() WHERE state='running' AND (lease_until IS NULL OR lease_until<=now()) RETURNING id,state`);
  return result.rows;
}

export async function claimJob(db: PoolClient, leaseSeconds = 30, kinds?: string[]) {
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 300) throw new HttpError(400, 'INVALID_LEASE');
  if (kinds !== undefined && (!Array.isArray(kinds) || kinds.some(kind => typeof kind !== 'string' || !/^[a-z][a-z0-9._-]{0,79}$/.test(kind)))) throw new HttpError(400, 'INVALID_JOB_KIND');
  const result = await db.query(`WITH candidate AS (SELECT id FROM jobs WHERE state IN ('queued','retry') AND available_at<=now() AND attempts<max_attempts AND ($3::text[] IS NULL OR kind=ANY($3)) ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) UPDATE jobs j SET state='running',attempts=attempts+1,lease_token=$1,lease_until=now()+make_interval(secs=>$2),updated_at=now() FROM candidate c WHERE j.id=c.id RETURNING j.*`, [uuid(), leaseSeconds, kinds ?? null]);
  return result.rows[0] ?? null;
}

export async function finishJob(db: PoolClient, id: string, lease: string, outcome: JobOutcome) {
  if (outcome.state === 'succeeded' ? !outcome.receipt || outcome.receipt.length > 200 : !/^[A-Z0-9_]{1,80}$/.test(outcome.code)) throw new HttpError(400, 'INVALID_JOB_OUTCOME');
  const job = (await db.query("SELECT * FROM jobs WHERE id=$1 AND state='running' AND lease_token=$2 AND lease_until>now() FOR UPDATE", [id, lease])).rows[0];
  if (!job) throw new HttpError(409, 'STALE_JOB_LEASE');
  const state = outcome.state === 'failed' ? (job.attempts >= job.max_attempts ? 'dead' : 'retry') : outcome.state;
  return (await db.query(`UPDATE jobs SET state=$1,receipt_id=$2,error_code=$3,lease_token=NULL,lease_until=NULL,available_at=now()+make_interval(secs=>LEAST(300,power(2,attempts)::int)),updated_at=now() WHERE id=$4 RETURNING id,state,attempts`, [state, outcome.state === 'succeeded' ? outcome.receipt : null, outcome.state === 'succeeded' ? null : outcome.code, id])).rows[0];
}

export async function jobMetadata(db: PoolClient, workspace?: string) {
  const query = workspace ? 'SELECT id,kind,state,attempts,max_attempts,available_at,error_code,created_at,updated_at FROM jobs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100' : 'SELECT id,kind,state,attempts,max_attempts,available_at,error_code,created_at,updated_at FROM jobs ORDER BY created_at DESC LIMIT 100';
  return (await db.query(query, workspace ? [workspace] : [])).rows;
}
