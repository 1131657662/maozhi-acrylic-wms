import { shipmentListSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { getOrder } from '../outbound/repository.ts';
import { remainingTotal } from './policy.ts';
import { shipmentBasis } from '../corrections/shipment-basis.ts';
import { effectiveShipment } from '../corrections/effective.ts';
import { shipmentDisplay } from './display.ts';

export async function shipmentList(db: Database, id: string) {
  return db.readSnapshot(async (tx) => {
    const order = await getOrder(tx, id);
    const basis = await shipmentBasis(tx, id);
    const quantities = new Map(
      basis.map((sh) => [sh.shipmentLineId, effectiveShipment(sh, order.corrections?.records ?? [])]),
    );
    const headers = await tx.all('SELECT * FROM outbound_shipments WHERE order_id=? ORDER BY seq', [id]);
    const lines = await tx.all(
      `SELECT sl.*,l.product_code,l.product_name FROM outbound_shipment_lines sl
      JOIN outbound_shipments sh ON sh.id=sl.shipment_id JOIN outbound_lines l ON l.id=sl.order_line_id
      WHERE sh.order_id=? ORDER BY sl.id`,
      [id],
    );
    const closed = await tx.get(
      'SELECT short_closed_at,short_close_reason,short_closed_packages,short_closed_grams FROM outbound_orders WHERE id=?',
      [id],
    );
    const complete = await tx.get(
      `SELECT created_at FROM operation_log WHERE target_id=? AND (action='outbound.complete' OR
        (action IN ('outbound.confirm','outbound.correction') AND JSON_VALID(after_json)
         AND JSON_UNQUOTE(JSON_EXTRACT(after_json,'$.status'))='confirmed')) ORDER BY id DESC LIMIT 1`,
      [id],
    );
    const remaining = ['short_closed', 'cancelled', 'voided'].includes(order.status)
      ? { packages: 0, weightGrams: 0 }
      : remainingTotal(order);
    return shipmentListSchema.parse({
      ...shipmentDisplay(order),
      nextSeq: Number(headers.at(-1)?.seq ?? 0) + 1,
      items: headers.map((row) => ({
        id: row.id,
        seq: Number(row.seq),
        vehicleNo: row.vehicle_no,
        shippedAt: isoDate(row.shipped_at),
        businessDate: row.business_date,
        operator: row.operator,
        packages: lines
          .filter((line) => line.shipment_id === row.id)
          .reduce((sum, line) => sum + Number(line.packages), 0),
        weightGrams: lines
          .filter((line) => line.shipment_id === row.id)
          .reduce((sum, line) => sum + Number(line.weight_grams), 0),
        effectivePackages: lines
          .filter((line) => line.shipment_id === row.id)
          .reduce((sum, line) => sum + quantities.get(String(line.id))!.effective.packages, 0),
        effectiveWeightGrams: lines
          .filter((line) => line.shipment_id === row.id)
          .reduce((sum, line) => sum + quantities.get(String(line.id))!.effective.weightGrams, 0),
        lines: lines
          .filter((line) => line.shipment_id === row.id)
          .map((line) => ({
            lineId: line.order_line_id,
            shipmentLineId: String(line.id),
            productCode: line.product_code,
            productName: line.product_name,
            packages: Number(line.packages),
            weightGrams: Number(line.weight_grams),
            effectivePackages: quantities.get(String(line.id))!.effective.packages,
            effectiveWeightGrams: quantities.get(String(line.id))!.effective.weightGrams,
            correctionPackages: quantities.get(String(line.id))!.delta.packages,
            correctionWeightGrams: quantities.get(String(line.id))!.delta.weightGrams,
            overageReason: line.overage_reason,
          })),
      })),
      remainingPackages: remaining.packages,
      remainingWeightGrams: remaining.weightGrams,
      completedAt: complete
        ? isoDate(complete.created_at)
        : order.status === 'confirmed' && headers.length
          ? isoDate(headers.at(-1)!.shipped_at)
          : null,
      shortClosure: closed?.short_closed_at
        ? {
            at: isoDate(closed.short_closed_at),
            reason: closed.short_close_reason,
            packages: Number(closed.short_closed_packages),
            weightGrams: Number(closed.short_closed_grams),
          }
        : null,
    });
  });
}
