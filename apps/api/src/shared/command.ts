import type { Database } from '../db/mysql.ts';
import { detailSchema, type Detail, type Revision } from '@wms/contracts';
import { hash } from './hash.ts';
import { ensure } from './errors.ts';
import type { Actor } from './audit.ts';

export interface PlanCommand { planId: string; key: string; expected: Revision; actor: Actor }
export async function lockPlan(db: Database, planId: string): Promise<void> {
  const plan = await db.get('SELECT id FROM outbound_orders WHERE id=? FOR UPDATE', [planId]);
  ensure(plan, 'NOT_FOUND', '出库计划不存在');
}
export async function replay(db: Database, scope: string, command: PlanCommand): Promise<Detail | undefined> {
  const key = `${scope}:${command.actor.username}:${command.key}`;
  const row = await db.get('SELECT payload_hash,result_json FROM idempotent_commands WHERE command_key=?', [key]);
  if (!row) return undefined;
  ensure(row.payload_hash === hash(JSON.stringify([command.planId, command.expected])),
    'IDEMPOTENCY_CONFLICT', '幂等键已使用且请求不同');
  return detailSchema.parse(JSON.parse(String(row.result_json)));
}
export async function saveResult(db: Database, options: {scope: string; command: PlanCommand}, result: Detail): Promise<void> {
  const {scope,command} = options;
  await db.run('INSERT INTO idempotent_commands(command_key,payload_hash,result_json) VALUES(?,?,?)',
    [`${scope}:${command.actor.username}:${command.key}`,hash(JSON.stringify([command.planId,command.expected])),JSON.stringify(result)]);
}
export function checkRevision(plan: Detail, expected: Revision): void {
  ensure(plan.revision === expected.revision && plan.digest === expected.digest,
    'STALE_PLAN', '计划或事实已变化，请刷新核对后再提交');
}
