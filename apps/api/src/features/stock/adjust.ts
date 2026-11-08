import { stockAdjustmentSchema, stockAdjustmentResultSchema, type StockAdjustment } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { createOperation, lockInventoryWriter } from '../inventory/operation.ts';
import { postInventory } from '../inventory/posting.ts';

export async function adjustStock(db: Database, input: StockAdjustment, key: string, actor: Actor) {
  const payload = stockAdjustmentSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const replay = await replayCommand(tx, 'stock.adjust', key, payload, actor, stockAdjustmentResultSchema);
    if (replay) return replay;
    const targetId = `${payload.warehouseCode}/${payload.productCode}`;
    const operation = await createOperation(tx, 'stock.adjust', targetId, payload.reason, actor);
    const [change] = await postInventory(tx, operation, payload.warehouseCode, [payload]);
    const result = stockAdjustmentResultSchema.parse({
      ...payload,
      operationId: operation.id,
      operationType: operation.type,
      before: change!.before,
      after: change!.after,
    });
    await audit(tx, actor, { action: operation.type, targetId: operation.id, before: result.before, after: result });
    await saveCommand(tx, 'stock.adjust', key, payload, actor, result);
    return result;
  });
}
