import type { LifecycleBlocker, Correction } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams, gramsToDecimal } from '../../db/weight.ts';
import type { LifecycleDocument } from '../document-lifecycle/document.ts';

function validJournal(row: Row, item: Correction, product: string, sign: number) {
  const matching = item.lines.filter((l) => l.productCode === product);
  const line = matching.length
    ? {
        delta: {
          packages: matching.reduce((s, l) => s + l.delta.packages, 0),
          weightGrams: matching.reduce((s, l) => s + l.delta.weightGrams, 0),
        },
      }
    : undefined;
  return (
    line &&
    row.correction_id === item.id &&
    row.operation_id === item.operationId &&
    row.operation_type === 'stock.correct' &&
    row.target_id === item.id &&
    Number(row.packages_delta) === sign * line.delta.packages &&
    decimalToGrams(row.tonnes_delta) === sign * line.delta.weightGrams
  );
}
async function expandLine(db: Database, base: Row, input: { records: Correction[]; sign: number }) {
  const applicable = input.records.filter((r) => r.lines.some((l) => l.productCode === base.product_code));
  if (!applicable.length) return base;
  const journals = await db.all(
    `SELECT j.*,o.operation_type,o.target_id FROM stock_journal j
    JOIN inventory_operations o ON o.id=j.operation_id WHERE j.operation_id IN (${applicable.map(() => '?').join(',')})
    AND j.product_code=? AND j.source_del_flag=0 ORDER BY j.id`,
    [...applicable.map((r) => r.operationId), String(base.product_code)],
  );
  if (journals.length !== applicable.length) return null;
  let previous = base,
    packages = Number(base.packages_delta),
    grams = decimalToGrams(base.tonnes_delta);
  for (const [index, row] of journals.entries()) {
    if (
      !validJournal(row, applicable[index]!, String(base.product_code), input.sign) ||
      row.warehouse_code !== base.warehouse_code ||
      Number(row.id) <= Number(previous.id) ||
      row.packages_before !== previous.packages_after ||
      row.tonnes_before !== previous.tonnes_after
    )
      return null;
    packages += Number(row.packages_delta);
    grams += decimalToGrams(row.tonnes_delta);
    previous = row;
  }
  const between = await db.all(
    `SELECT id FROM stock_journal WHERE warehouse_code=? AND product_code=?
    AND source_del_flag=0 AND id>? AND id<=? ORDER BY id`,
    [String(base.warehouse_code), String(base.product_code), Number(base.id), Number(previous.id)],
  );
  if (between.length !== journals.length) return null;
  return {
    ...base,
    id: previous.id,
    packages_delta: packages,
    tonnes_delta: gramsToDecimal(grams),
    packages_after: previous.packages_after,
    tonnes_after: previous.tonnes_after,
  };
}
export async function correctedReversalRows(db: Database, doc: LifecycleDocument, rows: Row[]) {
  const records = doc.fingerprint.corrections?.records ?? [];
  const expanded: Row[] = [];
  const blockers: LifecycleBlocker[] = [];
  for (const row of rows) {
    const result = records.some((r) => r.offsetOperationId)
      ? null
      : await expandLine(db, row, { records, sign: doc.kind === 'inbound' ? 1 : -1 });
    if (result) expanded.push(result);
    else
      blockers.push({
        code: 'CORRECTED_REVERSAL_BLOCKED',
        message: '更正流水不完整、不连续或夹有其他库存动作，禁止自动撤销；原单及更正证据保留。',
      });
  }
  return { rows: expanded, blockers };
}
