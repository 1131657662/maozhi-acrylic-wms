import type { Database } from './mysql.ts';
import { createHash } from 'node:crypto';
import { intValue, jsonRow, optional, readSampleCsv, required, type SampleRow } from './sample-reader.ts';

export async function seedHistory(db: Database, now: string): Promise<void> {
  const inbound = readSampleCsv('inbound_order');
  const inboundLines = readSampleCsv('inbound_order_detail');
  const outbound = readSampleCsv('outbound_order');
  const outboundLines = readSampleCsv('outbound_order_detail');
  const stock = readSampleCsv('stock');
  const journals = readSampleCsv('stock_journal');
  const inboundIds = new Map(inbound.map((row) => [required(row, 'order_no'), `erp-inbound-${required(row, 'id')}`]));
  const outboundIds = new Map(outbound.map((row) => [required(row, 'order_no'), `erp-outbound-${required(row, 'id')}`]));
  for (const row of inbound) await insertInbound(db, row, now);
  for (const row of inboundLines) await insertInboundLine(db, row, inboundIds);
  for (const row of outbound) await insertOutbound(db, row, now);
  for (const row of outboundLines) await insertOutboundLine(db, row, outboundIds);
  for (const row of stock) await insertStock(db, row);
  for (const row of journals) await insertJournal(db, row, now);
}

async function insertInbound(db: Database, row: SampleRow, now: string): Promise<void> {
  const sourceId = `erp-inbound-${required(row, 'id')}`;
  await db.run(`INSERT INTO inbound_receipts
    (id,receipt_no,supplier_code,warehouse_code,memo,created_by,created_at,status,source_id,source_del_flag,source_row_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`, [sourceId, required(row, 'order_no'), required(row, 'supplier_code'),
    required(row, 'warehouse_code'), optional(row, 'remark'), 'owner', optional(row, 'create_time') ?? now,
    required(row, 'order_status'), sourceId, intValue(row, 'del_flag'), jsonRow(row)]);
}

async function insertInboundLine(db: Database, row: SampleRow, ids: Map<string, string>): Promise<void> {
  const sourceId = `erp-inbound-line-${required(row, 'id')}`;
  await db.run(`INSERT INTO inbound_lines
    (id,receipt_id,product_code,packages,weight_tonnes,source_id,source_del_flag,source_row_json)
    VALUES(?,?,?,?,?,?,?,?)`, [sourceId, sourceIdFor(ids, row), required(row, 'product_code'),
    intValue(row, 'inbound_qty'), required(row, 'inbound_weight'), sourceId, intValue(row, 'del_flag'), jsonRow(row)]);
}

async function insertOutbound(db: Database, row: SampleRow, now: string): Promise<void> {
  const sourceId = `erp-outbound-${required(row, 'id')}`;
  await db.run(`INSERT INTO outbound_orders
    (id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,status,revision,created_at,source_id,source_order_status,source_del_flag,source_row_json)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [sourceId, required(row, 'order_no'), optional(row, 'customer_name') ?? '',
    optional(row, 'customer_code') ?? `SOURCE-CUSTOMER-${required(row, 'id')}`, required(row, 'warehouse_code'),
    optional(row, 'vehicle_no') ?? '', required(row, 'order_status'), 0, optional(row, 'create_time') ?? now,
    sourceId, required(row, 'order_status'), intValue(row, 'del_flag'), jsonRow(row)]);
}

async function insertOutboundLine(db: Database, row: SampleRow, ids: Map<string, string>): Promise<void> {
  const sourceId = `erp-outbound-line-${required(row, 'id')}`;
  await db.run(`INSERT INTO outbound_lines
    (id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,source_id,source_del_flag,source_row_json)
    VALUES(?,?,?,?,?,?,?,?,?)`, [sourceId, sourceIdFor(ids, row), required(row, 'product_code'),
    optional(row, 'product_name') ?? '', intValue(row, 'outbound_qty'), required(row, 'outbound_weight'), sourceId,
    intValue(row, 'del_flag'), jsonRow(row)]);
}

async function insertStock(db: Database, row: SampleRow): Promise<void> {
  const sourceId = `erp-stock-${required(row, 'id')}`;
  await db.run(`INSERT INTO stock
    (warehouse_code,product_code,packages,weight_tonnes,source_id,source_del_flag,source_row_json)
    VALUES(?,?,?,?,?,?,?)`, [required(row, 'warehouse_code'), required(row, 'product_code'), intValue(row, 'stock_qty'),
    required(row, 'stock_weight'), sourceId, intValue(row, 'del_flag'), jsonRow(row)]);
}

async function insertJournal(db: Database, row: SampleRow, now: string): Promise<void> {
  const sourceId = `erp-journal-${required(row, 'id')}`;
  await db.run(`INSERT INTO stock_journal
    (order_id,warehouse_code,product_code,packages_delta,tonnes_delta,created_at,source_id,source_order_no,source_business_type,source_del_flag,source_row_json)
    VALUES(NULL,?,?,?,?,?,?,?,?,?,?)`, [required(row, 'warehouse_code'), required(row, 'product_code'),
    intValue(row, 'change_qty'), required(row, 'change_weight'), optional(row, 'create_time') ?? now, sourceId,
    optional(row, 'order_no'), required(row, 'business_type'), intValue(row, 'del_flag'), jsonRow(row)]);
}

function sourceIdFor(ids: Map<string, string>, row: SampleRow): string {
  const orderNo = required(row, 'order_no');
  return ids.get(orderNo) ?? `erp-orphan-order-${createHash('sha256').update(orderNo).digest('hex').slice(0, 32)}`;
}
