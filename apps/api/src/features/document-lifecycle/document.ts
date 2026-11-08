import type { LifecycleKind } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { getInbound } from '../inbound/repository.ts';
import { getOrder } from '../outbound/repository.ts';
import { AppError } from '../../shared/errors.ts';

export const documentTables = {
  inbound: { table: 'inbound_receipts', reference: 'inbound_receipt_id' },
  outbound: { table: 'outbound_orders', reference: 'outbound_order_id' },
} as const;
export interface DocumentTarget {
  kind: LifecycleKind;
  id: string;
}
export async function lockDocument(db: Database, target: DocumentTarget): Promise<void> {
  const row = await db.get(`SELECT id FROM ${documentTables[target.kind].table} WHERE id=? FOR UPDATE`, [target.id]);
  if (!row) throw new AppError('NOT_FOUND', '单据不存在', 404);
}
export async function readDocument(db: Database, target: DocumentTarget) {
  const raw = await db.get(`SELECT source_id,source_del_flag FROM ${documentTables[target.kind].table} WHERE id=?`, [
    target.id,
  ]);
  if (target.kind === 'inbound') {
    const doc = await getInbound(db, target.id);
    return {
      ...target,
      number: doc.receiptNo,
      status: doc.status,
      warehouse: doc.warehouseCode,
      legacy: raw?.source_id !== null || doc.postingState === 'legacy',
      pending: doc.status === 'pending' && doc.postingState === 'pending',
      confirmed: doc.status === 'confirmed' && doc.postingState === 'confirmed',
      confirmationId: doc.confirmationOperationId,
      facts: 0,
      fingerprint: doc,
      lines: doc.lines.map((l) => ({ productCode: l.productCode, packages: l.packages, grams: l.weightGrams })),
    };
  }
  const doc = await getOrder(db, target.id);
  return {
    ...target,
    number: doc.orderNo,
    status: doc.status,
    warehouse: doc.warehouseCode,
    legacy: raw?.source_id !== null,
    pending: doc.status === 'open',
    confirmed: doc.status === 'confirmed',
    confirmationId: null,
    facts: doc.facts.length,
    fingerprint: doc,
    lines: doc.lines.map((l) => ({
      productCode: l.productCode,
      packages: -l.actualPackages,
      grams: -l.actualWeightGrams,
    })),
  };
}
export type LifecycleDocument = Awaited<ReturnType<typeof readDocument>>;
