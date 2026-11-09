import type { Database } from '../apps/api/src/db/mysql.ts';
import { reportMasters } from './report-fixtures.ts';

const warehouse = 'B3C-PERF-WH', productPrefix = 'B3C-PERF';

export async function seedDerivedReportPerformance(db: Database, count: number, day: string): Promise<void> {
  const productCount = Math.ceil(count / 200),
    inboundPerProduct = Math.ceil((count - productCount) / productCount),
    createdAt = new Date(`${day}T10:00:00+08:00`).toISOString().replace('T', ' ').slice(0, 23),
    openingAt = new Date(`${previousDay(day)}T10:00:00+08:00`).toISOString().replace('T', ' ').slice(0, 23);
  await reportMasters(db, warehouse);
  await db.transaction(async (tx) => {
    for (let productNo = 1; productNo <= productCount; productNo++)
      await tx.run(
        `INSERT IGNORE INTO master_products(code,name,source_kind,active,created_at,updated_at)
         VALUES(?,?,'erp-product',1,UTC_TIMESTAMP(),UTC_TIMESTAMP())`,
        [productCode(productNo), `B3c 性能商品 ${productNo}`],
      );
    for (let offset = 0; offset < count; offset += 500) {
      const end = Math.min(count, offset + 500),
        operations: (string | number)[] = [],
        journals: (string | number | null)[] = [],
        operationValues: string[] = [],
        journalValues: string[] = [];
      for (let index = offset; index < end; index++) {
        const opening = index < productCount,
          movementIndex = index - productCount,
          productNo = opening ? index + 1 : Math.floor(movementIndex / inboundPerProduct) + 1,
          eventNo = opening ? 0 : movementIndex % inboundPerProduct + 1,
          id = operationId(index + 1),
          product = productCode(productNo),
          beforeGrams = eventNo * 100_000,
          afterGrams = beforeGrams + 100_000,
          eventTime = opening ? openingAt : createdAt;
        operationValues.push('(?,?,?,?,?,?)');
        operations.push(id, 'inbound.confirm', `B3C-PERF-${index + 1}`, 'B3c 性能夹具', 'owner', eventTime);
        journalValues.push('(?,?,?,?,?,?,?,?,?,?,?,?)');
        journals.push(
          warehouse, product, 1, '0.1000', eventTime, id,
          eventNo, eventNo + 1, (beforeGrams / 1_000_000).toFixed(4), (afterGrams / 1_000_000).toFixed(4),
          null, null,
        );
      }
      await tx.run(
        `INSERT INTO inventory_operations(id,operation_type,target_id,reason,actor,created_at) VALUES ${operationValues.join(',')}`,
        operations,
      );
      await tx.run(
        `INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,operation_id,
          packages_before,packages_after,tonnes_before,tonnes_after,source_id,source_business_type) VALUES ${journalValues.join(',')}`,
        journals,
      );
    }
    for (let productNo = 1; productNo <= productCount; productNo++) {
      const packages = 1 + Math.min(inboundPerProduct, count - productCount - (productNo - 1) * inboundPerProduct),
        tonnes = (packages / 10).toFixed(4);
      await tx.run(
        `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_row_json) VALUES(?,?,?,?,?)`,
        [warehouse, productCode(productNo), packages, tonnes, JSON.stringify({ stock_qty: packages, stock_weight: tonnes })],
      );
    }
  });
}

function operationId(sequence: number): string {
  return `${sequence.toString(16).padStart(8, '0')}-0000-4000-8000-000000000001`;
}

function productCode(sequence: number): string {
  return `${productPrefix}-${sequence.toString().padStart(4, '0')}`;
}

function previousDay(day: string): string {
  return new Date(Date.parse(day + 'T00:00:00Z') - 86400_000).toISOString().slice(0, 10);
}
