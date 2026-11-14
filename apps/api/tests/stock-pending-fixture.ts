import { randomUUID } from 'node:crypto';
import { webStockListSchema } from '@wms/contracts';
import type { Database } from '../src/db/mysql.ts';
import type { numberingFixture } from './numbering-fixture.ts';

interface PendingPlan {
  warehouse?: string;
  product?: string;
  packages?: number;
  tonnes?: string;
  status?: string;
  deletedOrder?: number;
  deletedLine?: number;
}
export async function pendingPlan(db: Database, input: PendingPlan = {}): Promise<string> {
  const id = randomUUID();
  await db.run(
    `INSERT INTO outbound_orders(id,order_no,customer_name,warehouse_code,vehicle_no,status,created_at,source_del_flag)
    VALUES(?,?,'待发验收客户',?,'待发验收',?,UTC_TIMESTAMP(3),?)`,
    [id, id, input.warehouse ?? 'DEMO-WH', input.status ?? 'open', input.deletedOrder ?? 0],
  );
  await db.run(
    `INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,source_del_flag)
    VALUES(?, ?, ?, '待发验收商品', ?, ?, ?)`,
    [id, id, input.product ?? 'ACR-032', input.packages ?? 10, input.tonnes ?? '3.0000', input.deletedLine ?? 0],
  );
  return id;
}
export async function readStock(web: Awaited<ReturnType<typeof numberingFixture>>['web'], query = {}) {
  const response = await web
    .get('/api/v1/web/lists/stock')
    .query({ scope: 'inventory', product: 'ACR-032', ...query })
    .expect(200);
  return webStockListSchema.parse(response.body.data);
}
