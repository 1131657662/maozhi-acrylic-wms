import { z } from 'zod';
import { decimalToGrams } from '../../db/weight.ts';
import { isoDate } from '../../db/dates.ts';

const snapshotSchema = z.object({
  before_qty: z.union([z.string().regex(/^-?\d+$/), z.number().int()]).transform(Number),
  after_qty: z.union([z.string().regex(/^-?\d+$/), z.number().int()]).transform(Number),
  before_weight: z.string(),
  after_weight: z.string(),
});
function historicalValues(value: unknown) {
  if (typeof value !== 'string') return null;
  const parsed = snapshotSchema.safeParse(JSON.parse(value));
  if (!parsed.success) return null;
  const data = parsed.data;
  const tonnes = (input: string) =>
    decimalToGrams(input.includes('.') ? input.padEnd(input.indexOf('.') + 5, '0') : `${input}.0000`);
  return {
    before: { packages: data.before_qty, weightGrams: tonnes(data.before_weight) },
    after: { packages: data.after_qty, weightGrams: tonnes(data.after_weight) },
  };
}
export function journalItem(row: Record<string, unknown>) {
  const historical = row.source_id != null;
  const values = row.operation_id
    ? {
        before: { packages: Number(row.packages_before), weightGrams: decimalToGrams(row.tonnes_before) },
        after: { packages: Number(row.packages_after), weightGrams: decimalToGrams(row.tonnes_after) },
      }
    : historicalValues(row.source_row_json);
  const type = historical
    ? row.source_business_type
    : (row.source_business_type ??
      (row.inbound_receipt_id
        ? 'inbound'
        : row.order_id
          ? 'outbound'
          : row.operation_type === 'stocktake.post'
            ? 'stocktake.post'
            : row.operation_type === 'stock.adjust'
              ? 'adjustment'
              : null));
  return {
    id: String(row.id),
    type,
    warehouseCode: row.warehouse_code,
    productCode: row.product_code,
    packagesDelta: Number(row.packages_delta),
    weightDeltaGrams: decimalToGrams(row.tonnes_delta),
    createdAt: isoDate(row.created_at),
    before: values?.before ?? null,
    after: values?.after ?? null,
    operationId: row.operation_id ?? row.source_id ?? null,
    operationType: row.operation_type ?? type,
    reason: row.reason ?? null,
    evidenceKind: row.operation_id ? 'transaction' : historical ? 'source-snapshot' : 'legacy-unrecorded',
  };
}
export const journalOperationJoin = 'LEFT JOIN inventory_operations o ON o.id=j.operation_id';
export const journalFields = `j.*,o.operation_type,o.reason`;
