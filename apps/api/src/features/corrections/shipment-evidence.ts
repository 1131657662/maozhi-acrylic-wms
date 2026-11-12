import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { legacyConfirmationFrom } from '../outbound/original-actual.ts';

function validMovement(row: Row, doc: { id: string; warehouse: string }) {
  return (
    row.source_del_flag === 0 &&
    row.order_id === doc.id &&
    row.warehouse_code === doc.warehouse &&
    row.packages_before !== null &&
    row.packages_after !== null &&
    row.tonnes_before !== null &&
    row.tonnes_after !== null &&
    Number(row.packages_after) - Number(row.packages_before) === Number(row.packages_delta) &&
    decimalToGrams(row.tonnes_after) - decimalToGrams(row.tonnes_before) === decimalToGrams(row.tonnes_delta)
  );
}
async function shipmentMatches(db: Database, header: Row, journals: Row[]) {
  const expected = await db.all(
    `SELECT l.product_code,SUM(sl.packages) AS packages,SUM(sl.weight_grams) AS grams
    FROM outbound_shipment_lines sl JOIN outbound_lines l ON l.id=sl.order_line_id
    WHERE sl.shipment_id=? AND l.order_id=? GROUP BY l.product_code`,
    [String(header.id), String(header.order_id)],
  );
  return (
    expected.length > 0 &&
    expected.length === journals.length &&
    new Set(journals.map((row) => row.product_code)).size === journals.length &&
    expected.every((line) =>
      journals.some(
        (row) =>
          row.product_code === line.product_code &&
          Number(row.packages_delta) === -Number(line.packages) &&
          decimalToGrams(row.tonnes_delta) === -Number(line.grams),
      ),
    )
  );
}
export async function originalShipmentEvidence(
  db: Database,
  doc: { id: string; warehouse: string },
  operations: Row[],
) {
  const headers = await db.all(
    'SELECT id,order_id,seq,operation_id FROM outbound_shipments WHERE order_id=? ORDER BY seq',
    [doc.id],
  );
  const legacy = await db.all(`SELECT lj.* ${legacyConfirmationFrom} AND lj.order_id=? ORDER BY lj.id`, [doc.id]);
  const legacyOperations = new Set(legacy.map((row) => row.operation_id));
  if (!headers.length) return legacyOperations.size === operations.length ? undefined : null;
  if (
    legacyOperations.size > 1 ||
    headers.length + legacyOperations.size !== operations.length ||
    [...legacyOperations].some((id) => !operations.some((o) => o.id === id)) ||
    headers.some((h, index) => Number(h.seq) !== index + 1 || !operations.some((o) => o.id === h.operation_id))
  )
    return null;
  const journals = await db.all('SELECT * FROM stock_journal WHERE order_id=? ORDER BY id', [doc.id]);
  if (
    journals.some(
      (row) =>
        !validMovement(row, doc) ||
        (!legacyOperations.has(row.operation_id) && !headers.some((h) => h.operation_id === row.operation_id)),
    )
  )
    return null;
  if (legacy.length) {
    const firstModern = journals.find((row) => !legacyOperations.has(row.operation_id));
    if (!firstModern || legacy.some((row) => BigInt(String(row.id)) >= BigInt(String(firstModern.id)))) return null;
    const duplicates = await db.all(
      'SELECT product_code FROM outbound_lines WHERE order_id=? GROUP BY product_code HAVING COUNT(*)>1',
      [doc.id],
    );
    if (duplicates.length) return null; // Pre-016 lines were unique by product; never guess a legacy allocation.
  }
  for (const header of headers) {
    if (
      !(await shipmentMatches(
        db,
        header,
        journals.filter((row) => row.operation_id === header.operation_id),
      ))
    )
      return null;
  }
  return { originalOperationId: String(legacy[0]?.operation_id ?? headers[0]!.operation_id), journals };
}
