import { randomUUID } from 'node:crypto';
import { scanRecordResultSchema, type ScanRecordInput, type Detail } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { lockPlan } from '../../shared/command.ts';
import { AppError } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { recordFact } from '../scan/service.ts';
import { getOrder } from '../outbound/repository.ts';
import { selectedLine, barcodeEntry } from './catalog.ts';

export async function writableOrder(db: Database, id: string, adding: boolean): Promise<Detail> {
  const order = await getOrder(db, id);
  const header = await db.get('SELECT source_id FROM outbound_orders WHERE id=?', [id]);
  const shipped = await db.get('SELECT id FROM outbound_shipments WHERE order_id=? LIMIT 1', [id]);
  if (order.status !== 'open' || header?.source_id != null || shipped)
    throw new AppError('PLAN_CLOSED', '该单据只读，不能修改清点记录');
  if (adding && order.scanClosedAt) throw new AppError('PLAN_CLOSED', '已结束扫码，请先重新开启扫码');
  return order;
}
export async function addScanRecord(
  db: Database,
  id: string,
  entry: ScanRecordInput,
  key: string,
  actor: Actor,
  batchHash?: string,
) {
  const input = { id, entry, batchHash };
  return db.transaction(async (tx) => {
    await lockPlan(tx, id);
    const previous = await replayCommand(tx, 'web.scan.record', key, input, actor, scanRecordResultSchema);
    if (previous) return previous;
    const order = await writableOrder(tx, id, true);
    const line = selectedLine(order, entry.productCode);
    const existing = await tx.get('SELECT revoked_at FROM scan_facts WHERE plan_id=? AND barcode=?', [
      id,
      entry.barcode,
    ]);
    if (existing) throw new AppError('DUPLICATE_BARCODE', existing.revoked_at ? '已录入（已撤销）' : '已录入', 422);
    const catalog = await barcodeEntry(tx, entry.barcode, entry.productCode);
    const recordId = randomUUID();
    await recordFact(tx, {
      planId: id,
      actor,
      metadata: { source: entry.source, attribution: catalog.attribution },
      fact: {
        id: recordId,
        barcode: entry.barcode,
        catalogVersion: catalog.versionId,
        weightGrams: decimalToGrams(catalog.weightTonnes),
        weightSource: 'catalog',
        deviceId: 'web-counting',
        scannedAt: new Date().toISOString(),
        planVersion: 1,
      },
      context: { outboundLineId: line.id, sourceSpec: catalog.sourceSpec, resolvedAt: null },
    });
    const result = scanRecordResultSchema.parse({
      barcode: entry.barcode,
      productCode: entry.productCode,
      ok: true,
      reason: '已计入',
      recordId,
      attribution: catalog.attribution,
    });
    await saveCommand(tx, 'web.scan.record', key, input, actor, result);
    return result;
  });
}
