import type { LifecycleBlocker, LifecyclePreview } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import type { LifecycleDocument } from './document.ts';

const incomplete = {
  code: 'ORIGINAL_EVIDENCE_MISSING',
  message: '原确认操作或逐项流水证据不完整，禁止自动撤销；原单保留只读。',
};
function matches(doc: LifecycleDocument, rows: Row[]) {
  return (
    rows.length > 0 &&
    rows.length === doc.lines.length &&
    new Set(rows.map((r) => r.product_code)).size === rows.length &&
    rows.every(
      (r) =>
        r.source_del_flag === 0 &&
        r.warehouse_code === doc.warehouse &&
        r.packages_before !== null &&
        r.packages_after !== null &&
        r.tonnes_before !== null &&
        r.tonnes_after !== null &&
        doc.lines.some(
          (l) =>
            l.productCode === r.product_code &&
            l.packages === Number(r.packages_delta) &&
            l.grams === decimalToGrams(r.tonnes_delta),
        ),
    )
  );
}
async function inspectLine(db: Database, row: Row) {
  const params = [String(row.warehouse_code), String(row.product_code)];
  const later = await db.all(
    `SELECT id,operation_id,order_id,inbound_receipt_id FROM stock_journal
    WHERE warehouse_code=? AND product_code=? AND source_del_flag=0 AND id>? ORDER BY id LIMIT 21`,
    [...params, Number(row.id)],
  );
  const stock = await db.get(
    'SELECT packages,weight_tonnes FROM stock WHERE warehouse_code=? AND product_code=? AND source_del_flag=0',
    params,
  );
  const before = { packages: Number(stock?.packages ?? 0), grams: stock ? decimalToGrams(stock.weight_tonnes) : 0 };
  const blockers: LifecycleBlocker[] = [];
  if (later.length)
    blockers.push({
      code: 'DOWNSTREAM_DEPENDENCY',
      message: `${params.join(' / ')} 存在后续库存动作：${later
        .slice(0, 20)
        .map(
          (j) =>
            `流水#${j.id}（${j.operation_id ?? '历史未知操作'}，单据${j.order_id ?? j.inbound_receipt_id ?? '库存调整'}）`,
        )
        .join('；')}${later.length > 20 ? '；另有更多记录' : ''}。禁止自动撤销。`,
    });
  if (before.packages !== Number(row.packages_after) || before.grams !== decimalToGrams(row.tonnes_after))
    blockers.push({
      code: 'STOCK_EVIDENCE_MISMATCH',
      message: `${params.join(' / ')} 当前库存与原确认后值不一致，需先核实台账。`,
    });
  const packagesDelta = -Number(row.packages_delta),
    weightDeltaGrams = -decimalToGrams(row.tonnes_delta);
  if (before.packages + packagesDelta < 0 || before.grams + weightDeltaGrams < 0)
    blockers.push({ code: 'INSUFFICIENT_STOCK', message: '反向补偿将导致库存包数或实重为负，操作未执行。' });
  return {
    blockers,
    line: {
      journalId: Number(row.id),
      productCode: params[1]!,
      warehouseCode: params[0]!,
      packagesDelta,
      weightDeltaGrams,
      packagesBefore: before.packages,
      weightBeforeGrams: before.grams,
      packagesAfter: before.packages + packagesDelta,
      weightAfterGrams: before.grams + weightDeltaGrams,
    },
  };
}
export async function reversalProof(db: Database, doc: LifecycleDocument) {
  const operations = await db.all('SELECT id FROM inventory_operations WHERE operation_type=? AND target_id=?', [
    `${doc.kind}.confirm`,
    doc.id,
  ]);
  const originalOperationId = operations.length === 1 ? String(operations[0]!.id) : null;
  const lines: LifecyclePreview['lines'] = [],
    blockers: LifecycleBlocker[] = [];
  if (!originalOperationId || (doc.kind === 'inbound' && doc.confirmationId !== originalOperationId))
    return { originalOperationId, lines, blockers: [incomplete] };
  const rows = await db.all('SELECT * FROM stock_journal WHERE operation_id=? ORDER BY product_code,id', [
    originalOperationId,
  ]);
  const journalRef = doc.kind === 'inbound' ? 'inbound_receipt_id' : 'order_id';
  const unrelated = await db.get(
    `SELECT id FROM stock_journal WHERE ${journalRef}=? AND (operation_id IS NULL OR operation_id<>?) LIMIT 1`,
    [doc.id, originalOperationId],
  );
  if (!matches(doc, rows) || unrelated || rows.some((r) => r[journalRef] !== doc.id))
    return { originalOperationId, lines, blockers: [incomplete] };
  for (const row of rows) {
    const result = await inspectLine(db, row);
    lines.push(result.line);
    blockers.push(...result.blockers);
  }
  return { originalOperationId, lines, blockers };
}
