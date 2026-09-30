import type {PoolClient} from 'pg';
import {HttpError} from '../../core/security';

export const AI_RULE_MAX_COUNT = 100;
export const AI_RULE_MAX_CHARACTERS = 12000;
export type AiRuleSnapshot = {
  workspaceId: string;
  rules: Array<{id: string; version: number; title: string; content: string}>;
};

/** Transaction-scoped fence: writers are exclusive; reply commits can share it.
 * Acquire only during short database transactions, never around provider calls.
 */
export async function lockAiRules(db: PoolClient, workspaceId: string, mode: 'read' | 'write'): Promise<void> {
  const lock = mode === 'read' ? 'pg_advisory_xact_lock_shared' : 'pg_advisory_xact_lock';
  await db.query(`SELECT ${lock}(hashtextextended($1,0))`, [`ai-rules-workspace:${workspaceId}`]);
}

/** Caller must establish the authenticated workspace scope in its transaction. */
export async function loadAiRuleSnapshot(db: PoolClient, workspaceId: string): Promise<AiRuleSnapshot> {
  const scope = await db.query("SELECT current_setting('app.workspace_id',true) AS workspace_id");
  if (scope.rows[0]?.workspace_id !== workspaceId) throw new HttpError(403, 'AI_RULE_SCOPE_MISMATCH');
  const {rows} = await db.query<AiRuleSnapshot['rules'][number]>(
    `SELECT id,version,title,content FROM ai_rules
     WHERE workspace_id=$1 AND active=true ORDER BY id ASC LIMIT $2`,
    [workspaceId, AI_RULE_MAX_COUNT + 1],
  );
  const characters = rows.reduce((total, rule) => total + rule.title.length + rule.content.length, 0);
  if (rows.length > AI_RULE_MAX_COUNT || characters > AI_RULE_MAX_CHARACTERS) {
    throw new HttpError(409, 'AI_RULES_CONTEXT_LIMIT');
  }
  return {workspaceId, rules: rows};
}

/** Recheck immediately before publishing a reply; includes newly activated rules. */
export async function assertAiRuleSnapshotCurrent(db: PoolClient, snapshot: AiRuleSnapshot): Promise<void> {
  await lockAiRules(db, snapshot.workspaceId, 'read');
  const current = await loadAiRuleSnapshot(db, snapshot.workspaceId);
  if (JSON.stringify(current.rules) !== JSON.stringify(snapshot.rules)) {
    throw new HttpError(409, 'AI_RULES_CHANGED');
  }
}
