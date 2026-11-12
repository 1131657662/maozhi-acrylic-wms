import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams, gramsToDecimal } from '../../db/weight.ts';
import { originalShipmentEvidence } from '../corrections/shipment-evidence.ts';
import { assertPriorCorrectionEvidence } from '../corrections/evidence.ts';
import { AppError } from '../../shared/errors.ts';
import type { LifecycleDocument } from './document.ts';

async function foldProduct(db: Database, rows: Row[]) {
  const first = rows[0]!,
    last = rows.at(-1)!;
  const interval = await db.all(
    `SELECT id FROM stock_journal WHERE warehouse_code=? AND product_code=?
    AND source_del_flag=0 AND id>=? AND id<=? ORDER BY id`,
    [String(first.warehouse_code), String(first.product_code), String(first.id), String(last.id)],
  );
  if (
    interval.length !== rows.length ||
    rows.some(
      (row, i) =>
        i > 0 &&
        (Number(row.packages_before) !== Number(rows[i - 1]!.packages_after) ||
          decimalToGrams(row.tonnes_before) !== decimalToGrams(rows[i - 1]!.tonnes_after)),
    )
  )
    return null;
  return {
    ...first,
    id: last.id,
    packages_after: last.packages_after,
    tonnes_after: last.tonnes_after,
    packages_delta: rows.reduce((sum, row) => sum + Number(row.packages_delta), 0),
    tonnes_delta: gramsToDecimal(rows.reduce((sum, row) => sum + decimalToGrams(row.tonnes_delta), 0)),
  };
}
// Validate each immutable shipment against its own operation before folding the whole-document compensation.
export async function shipmentReversalRows(db: Database, doc: LifecycleDocument, operations: Row[]) {
  const original = await originalShipmentEvidence(db, doc, operations);
  if (!original) return original;
  const records = doc.fingerprint.corrections?.records ?? [];
  if (records.some((r) => r.offsetOperationId)) return null;
  try {
    await assertPriorCorrectionEvidence(db, doc, { warehouse: doc.warehouse, summary: doc.fingerprint.corrections! });
  } catch (error) {
    if (error instanceof AppError && error.code === 'CORRECTION_EVIDENCE_INVALID') return null;
    throw error;
  }
  const corrections = records.length
    ? await db.all(
        `SELECT * FROM stock_journal WHERE correction_id IN (${records.map(() => '?').join(',')}) ORDER BY id`,
        records.map((r) => r.id),
      )
    : [];
  const journals = [...original.journals, ...corrections].sort((a, b) =>
    BigInt(String(a.id)) < BigInt(String(b.id)) ? -1 : 1,
  );
  const rows: Row[] = [];
  for (const product of new Set(journals.map((row) => row.product_code))) {
    const folded = await foldProduct(
      db,
      journals.filter((row) => row.product_code === product),
    );
    if (!folded) return null;
    rows.push(folded);
  }
  return { originalOperationId: original.originalOperationId, rows };
}
