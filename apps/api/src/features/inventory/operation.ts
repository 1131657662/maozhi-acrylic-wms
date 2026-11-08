import { randomUUID } from 'node:crypto';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';

export type OperationType =
  'inbound.confirm' | 'outbound.confirm' | 'stock.adjust' | 'inbound.reverse' | 'outbound.reverse' | 'stocktake.post';
export interface InventoryOperation {
  id: string;
  type: OperationType;
  targetId: string;
}

// Match the existing creation lock order; a single owner does not need parallel inventory writers.
export async function lockInventoryWriter(db: Database): Promise<void> {
  const identity = await db.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
  ensure(identity, 'DATABASE_NOT_READY', '本地数据库尚未初始化');
}
export async function createOperation(
  db: Database,
  type: OperationType,
  targetId: string,
  reason: string,
  actor: Actor,
): Promise<InventoryOperation> {
  const id = randomUUID();
  await db.run(
    `INSERT INTO inventory_operations(id,operation_type,target_id,reason,actor,created_at)
    VALUES(?,?,?,?,?,UTC_TIMESTAMP(3))`,
    [id, type, targetId, reason, actor.username],
  );
  return { id, type, targetId };
}
