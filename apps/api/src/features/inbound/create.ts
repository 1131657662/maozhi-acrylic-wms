import { randomUUID } from 'node:crypto';
import { createInboundSchema, inboundReceiptSchema, type CreateInbound } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { sqlDate } from '../../db/dates.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { activeMaster } from '../master-data/catalogs.ts';
import { getInbound } from './repository.ts';

export async function createInbound(db: Database, input: CreateInbound, key: string, actor: Actor) {
  const payload = createInboundSchema.parse(input);
  try {
    return await db.transaction(async (tx) => {
      await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
      const replay = await replayCommand(tx, 'inbound.create', key, payload, actor, inboundReceiptSchema);
      if (replay) return replay;
      const supplier = await activeMaster(tx, 'suppliers', payload.supplierCode);
      const warehouse = await activeMaster(tx, 'warehouses', payload.warehouseCode);
      const products = await Promise.all(payload.lines.map((line) => activeMaster(tx, 'products', line.productCode)));
      const id = randomUUID();
      const createdAt = sqlDate(new Date().toISOString());
      await tx.run(`INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,memo,created_by,created_at)
        VALUES(?,?,?,?,?,?,?)`, [id,payload.receiptNo,supplier.code,warehouse.code,payload.memo ?? null,actor.username,createdAt]);
      await addLinesAndStock(tx, id, warehouse.code, payload, products, createdAt);
      const after = await getInbound(tx, id);
      await audit(tx, actor, { action: 'inbound.confirm', targetId: id, before: null, after });
      await saveCommand(tx, 'inbound.create', key, payload, actor, after);
      return after;
    });
  } catch (error) {
    if (duplicate(error)) throw new AppError('RECEIPT_NO_EXISTS', '入库单号已存在');
    throw error;
  }
}
async function addLinesAndStock(db: Database, id: string, warehouseCode: string, input: CreateInbound,
  products: { code: string; name: string; active: true }[], createdAt: string): Promise<void> {
  for (const [index, line] of input.lines.entries()) {
    const product = products[index]!;
    const weight = gramsToDecimal(line.weightGrams);
    await db.run('INSERT INTO inbound_lines(id,receipt_id,product_code,packages,weight_tonnes) VALUES(?,?,?,?,?)',
      [randomUUID(),id,product.code,line.packages,weight]);
    await db.run(`INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES(?,?,?,?)
      ON DUPLICATE KEY UPDATE packages=packages+VALUES(packages),weight_tonnes=weight_tonnes+VALUES(weight_tonnes)`,
      [warehouseCode,product.code,line.packages,weight]);
    await db.run(`INSERT INTO stock_journal(inbound_receipt_id,warehouse_code,product_code,packages_delta,tonnes_delta,created_at)
      VALUES(?,?,?,?,?,?)`, [id,warehouseCode,product.code,line.packages,weight,createdAt]);
  }
}
function duplicate(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}
