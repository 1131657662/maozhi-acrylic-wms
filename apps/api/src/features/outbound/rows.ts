import { z } from 'zod';
import { orderSchema, lineSchema, factSchema } from '@wms/contracts';
import { decimalToGrams } from '../../db/weight.ts';
import { isoDate } from '../../db/dates.ts';

export const headerSchema = orderSchema
  .omit({
    scanPackages: true,
    scanWeightGrams: true,
    plannedPackages: true,
    plannedWeightGrams: true,
    actualPackages: true,
    actualWeightGrams: true,
  })
  .extend({
    revision: z.coerce.number().int(),
    planVersion: z.coerce.number().pipe(z.literal(1)),
    createdAt: z.string().transform(isoDate),
    scanClosedAt: z.string().transform(isoDate).nullable(),
  });
export const rawLineSchema = lineSchema.omit({ actualPackages: true, actualWeightGrams: true }).extend({
  orderId: z.string(),
  plannedPackages: z.coerce.number().int(),
  plannedWeightGrams: z.string().transform(decimalToGrams),
  scanPackages: z.coerce.number().int().nullable(),
  scanWeightGrams: z.coerce.number().int().nullable(),
  actualPackages: z.coerce.number().int().nullable(),
  actualWeightGrams: z.coerce.number().int().nullable(),
});
export const rawFactSchema = factSchema.extend({
  catalogVersion: z.coerce.number().int().positive(),
  weightGrams: z.string().transform(decimalToGrams),
  scannedAt: z.string().transform(isoDate),
  receivedAt: z.string().transform(isoDate),
  planVersion: z.coerce.number().pipe(z.literal(1)),
});
export const headerSql = `SELECT id,order_no AS orderNo,customer_name AS customerName,customer_code AS customerCode,warehouse_code AS warehouseCode,
  warehouse_name_snapshot AS warehouseName,contact_id AS contactId,vehicle_id AS vehicleId,
  ship_to_name AS shipToName,ship_to_phone AS shipToPhone,ship_to_address AS shipToAddress,vehicle_no AS vehicleNo,memo,status,scan_closed_at AS scanClosedAt,revision,1 AS planVersion,created_at AS createdAt,business_date AS businessDate FROM outbound_orders`;
export const lineSql = `SELECT id,order_id AS orderId,product_code AS productCode,product_name AS productName,
  product_model_snapshot AS productModel,package_type_snapshot AS packageType,planned_packages AS plannedPackages,planned_weight_tonnes AS plannedWeightGrams,scan_packages AS scanPackages,scan_weight_grams AS scanWeightGrams,
  (SELECT SUM(sl.packages) FROM outbound_shipment_lines sl WHERE sl.order_line_id=outbound_lines.id) AS actualPackages,
  (SELECT SUM(sl.weight_grams) FROM outbound_shipment_lines sl WHERE sl.order_line_id=outbound_lines.id) AS actualWeightGrams FROM outbound_lines`;
export const factSql = `SELECT id,plan_id AS planId,barcode,weight_tonnes AS weightGrams,catalog_version AS catalogVersion,
  weight_source AS weightSource,device_id AS deviceId,scanned_at AS scannedAt,received_at AS receivedAt,
  recorded_by AS recordedBy,1 AS planVersion FROM scan_facts`;
