import { correctionSchema, type Correction, type CorrectionTarget } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { isoDate } from '../../db/dates.ts';
import { AppError, ensure } from '../../shared/errors.ts';

function line(row: Row) {
  return {
    originalLineId: String(row.inbound_line_id ?? row.outbound_line_id),
    productCode: row.product_code,
    before: { packages: Number(row.packages_before), weightGrams: decimalToGrams(row.tonnes_before) },
    after: { packages: Number(row.packages_after), weightGrams: decimalToGrams(row.tonnes_after) },
    delta: { packages: Number(row.packages_delta), weightGrams: decimalToGrams(row.tonnes_delta) },
  };
}
async function records(db: Database, headers: Row[]): Promise<Correction[]> {
  if (!headers.length) return [];
  const rows = await db.all(
    `SELECT * FROM document_correction_lines
    WHERE correction_id IN (${headers.map(() => '?').join(',')}) ORDER BY product_code,inbound_line_id,outbound_line_id`,
    headers.map((h) => String(h.id)),
  );
  return headers.map((h) =>
    correctionSchema.parse({
      id: h.id,
      number: h.number,
      kind: h.inbound_receipt_id ? 'inbound' : 'outbound',
      originalId: h.inbound_receipt_id ?? h.outbound_order_id,
      previousCorrectionId: h.previous_correction_id,
      revision: Number(h.revision),
      reason: h.reason,
      actor: h.actor,
      createdAt: isoDate(h.created_at),
      operationId: h.operation_id,
      offsetOperationId: h.offset_operation_id,
      lines: rows.filter((r) => r.correction_id === h.id).map(line),
    }),
  );
}
export function assertCorrectionChain(items: Correction[]): void {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    const visited = new Set<string>();
    let cursor: Correction | undefined = item;
    while (cursor) {
      ensure(!visited.has(cursor.id), 'CORRECTION_CYCLE', '更正链成环，禁止入账');
      visited.add(cursor.id);
      const parent: string | null = cursor.previousCorrectionId;
      ensure(parent === null || byId.has(parent), 'CORRECTION_CHAIN_INVALID', '更正链不属于同一原单或前序记录缺失');
      cursor = parent === null ? undefined : byId.get(parent);
    }
  }
  items.forEach((item, index) =>
    ensure(
      item.revision === index + 1 && item.previousCorrectionId === (items[index - 1]?.id ?? null),
      'CORRECTION_CHAIN_INVALID',
      '更正链版本不连续',
    ),
  );
}
export async function readCorrections(db: Database, target: CorrectionTarget): Promise<Correction[]> {
  const ref = target.kind === 'inbound' ? 'inbound_receipt_id' : 'outbound_order_id';
  const result = await records(
    db,
    await db.all(`SELECT * FROM document_corrections WHERE ${ref}=? ORDER BY revision`, [target.id]),
  );
  assertCorrectionChain(result);
  return result;
}
export async function readCorrection(db: Database, id: string): Promise<Correction> {
  const header = await db.get('SELECT * FROM document_corrections WHERE id=?', [id]);
  if (!header) throw new AppError('NOT_FOUND', '更正单不存在', 404);
  return (await records(db, [header]))[0]!;
}
