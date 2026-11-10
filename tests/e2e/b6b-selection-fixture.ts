import { randomUUID } from 'node:crypto';
import { actor } from '../../apps/api/tests/fixture';
import { createInbound } from '../../apps/api/src/features/inbound/create';
import { confirmInbound } from '../../apps/api/src/features/inbound/confirm';
import { e2eDatabase, inventoryCell } from './inventory-helpers';

export async function mixedInbound() {
  const db = e2eDatabase();
  const prefix = 'B6B-MIX-' + randomUUID().slice(0, 8);
  try {
    const cell = await inventoryCell(db);
    const documents = [];
    for (const [index, status] of ['audited', 'submit', 'confirmed'].entries()) {
      const receipt = await createInbound(
        db,
        {
          receiptNo: `${prefix}-${index}`,
          supplierCode: 'DEMO-SUPPLIER',
          warehouseCode: cell.warehouseCode,
          lines: [{ productCode: cell.productCode, packages: 1, weightGrams: 302500 }],
        },
        randomUUID(),
        actor,
      );
      if (status === 'confirmed') await confirmInbound(db, receipt.id, randomUUID(), actor);
      else
        await db.run("UPDATE inbound_receipts SET status=?,posting_state='legacy',source_id=? WHERE id=?", [
          status,
          index + 800000,
          receipt.id,
        ]);
      documents.push({ id: receipt.id, number: receipt.receiptNo });
    }
    return { prefix, documents };
  } finally {
    await db.close();
  }
}
