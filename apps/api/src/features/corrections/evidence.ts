import type { CorrectionSummary, CorrectionTarget } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { ensure } from '../../shared/errors.ts';

function balanced(row: Row): boolean {
  return (
    row.packages_before != null &&
    row.packages_after != null &&
    row.tonnes_before != null &&
    row.tonnes_after != null &&
    Number(row.packages_before) + Number(row.packages_delta) === Number(row.packages_after) &&
    decimalToGrams(row.tonnes_before) + decimalToGrams(row.tonnes_delta) === decimalToGrams(row.tonnes_after)
  );
}
export async function assertOriginalEvidence(
  db: Database,
  target: CorrectionTarget,
  original: { operationId: string; warehouse: string; summary: CorrectionSummary },
) {
  const sign = target.kind === 'inbound' ? 1 : -1;
  const rows = await db.all('SELECT * FROM stock_journal WHERE operation_id=?', [original.operationId]);
  const ref = target.kind === 'inbound' ? 'inbound_receipt_id' : 'order_id';
  ensure(
    rows.length ===
      grouped(original.summary.lines.map((l) => ({ productCode: l.productCode, ...l.original }))).length &&
      grouped(original.summary.lines.map((l) => ({ productCode: l.productCode, ...l.original }))).every(
        (line) =>
          rows.filter(
            (r) =>
              r.product_code === line.productCode &&
              r[ref] === target.id &&
              r.warehouse_code === original.warehouse &&
              r.source_del_flag === 0 &&
              r.correction_id === null &&
              Number(r.packages_delta) === sign * line.packages &&
              decimalToGrams(r.tonnes_delta) === sign * line.weightGrams &&
              balanced(r),
          ).length === 1,
      ),
    'ORIGINAL_EVIDENCE_MISSING',
    '原确认流水与原单数量不一致，不能更正',
  );
}
export async function assertPriorCorrectionEvidence(
  db: Database,
  target: CorrectionTarget,
  original: { warehouse: string; summary: CorrectionSummary },
) {
  const sign = target.kind === 'inbound' ? 1 : -1;
  const records = original.summary.records;
  if (!records.length) return;
  const rows = await db.all(
    `SELECT j.*,o.operation_type,o.target_id FROM stock_journal j
    JOIN inventory_operations o ON o.id=j.operation_id WHERE j.operation_id IN (${records.map(() => '?').join(',')})`,
    records.map((r) => r.operationId),
  );
  ensure(
    rows.length ===
      records.reduce(
        (sum, record) => sum + grouped(record.lines.map((l) => ({ productCode: l.productCode, ...l.delta }))).length,
        0,
      ) &&
      records.every(
        (record) =>
          record.lines.length > 0 &&
          grouped(record.lines.map((l) => ({ productCode: l.productCode, ...l.delta }))).every(
            (line) =>
              rows.filter(
                (r) =>
                  r.correction_id === record.id &&
                  r.operation_id === record.operationId &&
                  r.operation_type === 'stock.correct' &&
                  r.target_id === record.id &&
                  r.product_code === line.productCode &&
                  r.warehouse_code === original.warehouse &&
                  r.source_del_flag === 0 &&
                  Number(r.packages_delta) === sign * line.packages &&
                  decimalToGrams(r.tonnes_delta) === sign * line.weightGrams &&
                  balanced(r),
              ).length === 1,
          ),
      ),
    'CORRECTION_EVIDENCE_INVALID',
    '前序更正流水缺失或与差额不一致，不能继续更正',
  );
}

function grouped(lines: { productCode: string; packages: number; weightGrams: number }[]) {
  const result = new Map<string, { productCode: string; packages: number; weightGrams: number }>();
  for (const line of lines) {
    const value = result.get(line.productCode) ?? { productCode: line.productCode, packages: 0, weightGrams: 0 };
    value.packages += line.packages;
    value.weightGrams += line.weightGrams;
    result.set(line.productCode, value);
  }
  return [...result.values()];
}
