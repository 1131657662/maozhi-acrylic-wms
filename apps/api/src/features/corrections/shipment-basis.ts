import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';

export interface ShipmentBasis {
  shipmentLineId: string;
  shipmentId: string;
  seq: number;
  vehicleNo: string;
  shippedAt: string;
  lineId: string;
  productCode: string;
  original: { packages: number; weightGrams: number };
  journalId: bigint;
}
export async function shipmentBasis(db: Database, orderId: string): Promise<ShipmentBasis[]> {
  const rows = await db.all(
    `SELECT sl.id,sl.shipment_id,sl.order_line_id,sl.packages,sl.weight_grams,
    sh.seq,sh.vehicle_no,sh.shipped_at,l.product_code,
    (SELECT MIN(j.id) FROM stock_journal j WHERE j.operation_id=sh.operation_id) AS journal_id
    FROM outbound_shipments sh JOIN outbound_shipment_lines sl ON sl.shipment_id=sh.id
    JOIN outbound_lines l ON l.id=sl.order_line_id AND l.order_id=sh.order_id
    WHERE sh.order_id=? ORDER BY sh.seq,sl.id`,
    [orderId],
  );
  return rows.map((row) => ({
    shipmentLineId: String(row.id),
    shipmentId: String(row.shipment_id),
    seq: Number(row.seq),
    vehicleNo: String(row.vehicle_no),
    shippedAt: isoDate(row.shipped_at),
    lineId: String(row.order_line_id),
    productCode: String(row.product_code),
    original: { packages: Number(row.packages), weightGrams: Number(row.weight_grams) },
    journalId: BigInt(String(row.journal_id ?? 0)),
  }));
}
