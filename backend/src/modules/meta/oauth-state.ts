import {randomBytes} from 'node:crypto';
import type {PoolClient} from 'pg';
import {digest, HttpError} from '../../core/security';
import {requirePermission} from '../../core/authorization';
import type {Identity} from '../../middlewares/auth.middleware';
export type MetaProvider = 'facebook' | 'instagram';

/** Caller derives actor through identity() within the same transaction. */
export async function createMetaOAuthState(db: PoolClient, actor: Identity, provider: MetaProvider): Promise<string> {
  requirePermission(actor.role, 'channels.manage');
  const state = randomBytes(32).toString('hex');
  await db.query(`INSERT INTO meta_oauth_attempts(state_hash,workspace_id,user_id,session_hash,provider)
    VALUES($1,$2,$3,$4,$5)`, [digest(state),actor.workspace_id,actor.user_id,actor.token_hash,provider]);
  return state;
}

/** Commit consumption before external exchange; failed exchanges require a fresh connect. */
export async function consumeMetaOAuthState(db: PoolClient, actor: Identity, provider: MetaProvider, state: string): Promise<void> {
  requirePermission(actor.role, 'channels.manage');
  if (!/^[a-f0-9]{64}$/.test(state)) throw new HttpError(400,'META_OAUTH_STATE_INVALID');
  const result = await db.query(`UPDATE meta_oauth_attempts SET consumed_at=now()
    WHERE state_hash=$1 AND workspace_id=$2 AND user_id=$3 AND session_hash=$4 AND provider=$5
    AND consumed_at IS NULL AND expires_at>now() RETURNING state_hash`,
    [digest(state),actor.workspace_id,actor.user_id,actor.token_hash,provider]);
  if (!result.rowCount) throw new HttpError(400,'META_OAUTH_STATE_INVALID');
}
