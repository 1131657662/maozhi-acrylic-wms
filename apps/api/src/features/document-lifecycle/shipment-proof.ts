import type { Database, Row } from '../../db/mysql.ts';
import { decimalToGrams, gramsToDecimal } from '../../db/weight.ts';
import type { LifecycleDocument } from './document.ts';

function validMovement(row: Row, doc: LifecycleDocument) {
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
async function foldProduct(db: Database, rows: Row[]) {
  const first = rows[0]!,
    last = rows.at(-1)!;
  const interval = await db.all(
    `SELECT id FROM stock_journal WHERE warehouse_code=? AND product_code=?
    AND source_del_flag=0 AND id>=? AND id<=? ORDER BY id`,
    [String(first.warehouse_code), String(first.product_code), Number(first.id), Number(last.id)],
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
  const headers = await db.all(
    'SELECT id,order_id,seq,operation_id FROM outbound_shipments WHERE order_id=? ORDER BY seq',
    [doc.id],
  );
  if (!headers.length) return undefined; // Pre-016 confirmation evidence uses the original proof path.
  if (
    headers.length !== operations.length ||
    headers.some((h, index) => Number(h.seq) !== index + 1 || !operations.some((o) => o.id === h.operation_id))
  )
    return null;
  const journals = await db.all('SELECT * FROM stock_journal WHERE order_id=? ORDER BY id', [doc.id]);
  if (journals.some((row) => !validMovement(row, doc) || !headers.some((h) => h.operation_id === row.operation_id)))
    return null;
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
  const rows: Row[] = [];
  for (const product of new Set(journals.map((row) => row.product_code))) {
    const folded = await foldProduct(
      db,
      journals.filter((row) => row.product_code === product),
    );
    if (!folded) return null;
    rows.push(folded);
  }
  return { originalOperationId: String(headers[0]!.operation_id), rows };
}
