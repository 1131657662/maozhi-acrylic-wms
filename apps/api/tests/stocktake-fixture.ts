import { randomUUID } from 'node:crypto';
import type { Database } from '../src/db/mysql.ts';
import { actor } from './fixture.ts';
import { createStocktake } from '../src/features/stocktake/create.ts';
import { saveReading } from '../src/features/stocktake/save-reading.ts';
import { stocktakePreview } from '../src/features/stocktake/preview.ts';

export async function counted(db: Database, actual = { packages: 5, weightGrams: 1523100 }) {
  const take = await createStocktake(db, { warehouseCode: 'DEMO-WH' }, randomUUID(), actor);
  await saveReading(db, {
    id: take.id,
    productCode: 'ACR-032',
    input: { expectedRevision: 0, actual },
    key: randomUUID(),
    actor,
  });
  return stocktakePreview(db, take.id);
}
export function postCommand(preview: Awaited<ReturnType<typeof stocktakePreview>>) {
  return {
    id: preview.stocktake.id,
    input: { expectedToken: preview.token, reason: '隔离验收：人工核对盘点差异', acknowledgeSnapshotBasis: false },
    key: randomUUID(),
    actor,
  };
}
export async function injectStocktakeFailure(db: Database, table: string, event: 'INSERT' | 'UPDATE', condition = '1') {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  if (!/^maozhi_test_[a-f0-9]{24}$/.test(name)) throw new Error('Only isolated test DBs may inject failures');
  if (
    ![
      'inventory_operations',
      'stock',
      'stock_journal',
      'stocktakes',
      'stocktake_windows',
      'stocktake_snapshots',
      'stocktake_readings',
      'operation_log',
      'idempotent_commands',
    ].includes(table)
  )
    throw new Error('Unsupported failure target');
  if (!/^[a-zA-Z0-9_.= '<>-]+$/.test(condition)) throw new Error('Unsupported fixture condition');
  await db.run(`CREATE TRIGGER b3a_fail AFTER ${event} ON ${table} FOR EACH ROW BEGIN
    IF ${condition} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='B3A injected failure'; END IF; END`);
}
