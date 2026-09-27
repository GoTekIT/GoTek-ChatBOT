import {lockAiRules} from './ai-rule-snapshot';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {audit,requireRole,uuid} from './security';

const rule = z.object({
  title: z.string().trim().min(1).max(150),
  content: z.string().trim().min(1).max(2000),
  active: z.boolean().optional().default(true),
}).strict();
const importBody = z.object({
  format: z.literal('gotek-ai-rules').optional(),
  version: z.literal(1).optional(),
  exportedAt: z.string().datetime().optional(),
  rules: z.array(rule).min(1).max(100),
}).strict();

/** Return a portable workspace-scoped export. No IDs or tenant identifiers are exposed. */
export async function exportRules(db: PoolClient, actor: any) {
  requireRole(actor.role);
  const rows = (await db.query(
    `SELECT title,content,active FROM ai_rules
     WHERE workspace_id=$1 ORDER BY created_at ASC`, [actor.workspace_id],
  )).rows;
  return {format: 'gotek-ai-rules', version: 1, exportedAt: new Date().toISOString(), rules: rows};
}

/** Import creates new rules in the current workspace; it never accepts foreign IDs or overwrites data. */
export async function importRules(db: PoolClient, actor: any, body: unknown) {
  requireRole(actor.role);
  const data = importBody.parse(body);
  await lockAiRules(db, actor.workspace_id, 'write');
  const created: any[] = [];
  for (const input of data.rules) {
    const id = uuid();
    const row = (await db.query(
      `INSERT INTO ai_rules(id,workspace_id,title,content,active,created_by)
       VALUES($1,$2,$3,$4,$5,$6)
       RETURNING id,title,content,active,version,created_by,updated_at,created_at`,
      [id, actor.workspace_id, input.title, input.content, input.active, actor.user_id],
    )).rows[0];
    await audit(db, actor.workspace_id, actor.user_id, 'ai_rule.imported', id);
    created.push(row);
  }
  return {imported: created.length, rules: created};
}
