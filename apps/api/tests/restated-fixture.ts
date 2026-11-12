import { randomUUID } from 'node:crypto';
import { reportMonthlySchema, reportDetailsSchema } from '@wms/contracts';
import type { Database } from '../src/db/mysql.ts';
import { reportFixture } from './report-fixture.ts';
import { reportMasters } from '../../../scripts/report-fixtures.ts';

export const restatedQuery = {
  source: 'erp-product',
  product: 'RST-P',
  warehouse: 'RST-W',
  fromDay: '2026-01-01',
  toDay: '2026-02-28',
  pageSize: '200',
  direction: 'asc',
};
export const firstCorrectionId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const confirmationId = '10000000-0000-4000-8000-000000000001';
export async function restatedFixture() {
  const f = await reportFixture();
  try {
    await reportMasters(f.db, 'RST-P');
    await reportMasters(f.db, 'RST-W');
    await seedDocument(f.db);
    await seedLedger(f.db);
    const read = async (query: Record<string, string> = {}) =>
      reportMonthlySchema.parse(
        (
          await f.api
            .get('/api/v1/web/reports/monthly')
            .query({ ...restatedQuery, ...query })
            .set('Cookie', f.cookie)
            .expect(200)
        ).body.data,
      );
    const details = async (query: Record<string, string> = {}) =>
      reportDetailsSchema.parse(
        (
          await f.api
            .get('/api/v1/web/reports/details')
            .query({ ...restatedQuery, ...query })
            .set('Cookie', f.cookie)
            .expect(200)
        ).body.data,
      );
    return { ...f, read, details };
  } catch (error) {
    await f.dispose();
    throw error;
  }
}
async function seedDocument(db: Database): Promise<void> {
  await db.run(
    `INSERT INTO inventory_operations(id,operation_type,target_id,reason,actor,created_at)
    VALUES(?,'inbound.confirm','B5D2-IN','独立合成报表验收','owner','2026-01-15 02:00:00')`,
    [confirmationId],
  );
  await db.run(
    `INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,created_by,created_at,
    posting_state,confirmation_operation_id,business_date)
    VALUES('B5D2-IN','RK-20260115-901','DEMO-SUPPLIER','RST-W','owner','2026-01-14 02:00:00','confirmed',?,'2026-01-15')`,
    [confirmationId],
  );
}
async function seedLedger(db: Database): Promise<void> {
  const source = JSON.stringify({
    create_time: '2025-12-31 12:00:00',
    before_qty: 0,
    after_qty: 100,
    before_weight: '0.0000',
    after_weight: '30.0000',
  });
  await db.run(
    `INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,
    source_id,source_business_type,source_del_flag,source_row_json)
    VALUES('RST-W','RST-P',100,'30.0000','2025-12-31 12:00:00','B5D2-OPEN','import',0,?)`,
    [source],
  );
  await db.run(
    `INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,
    operation_id,inbound_receipt_id,packages_before,packages_after,tonnes_before,tonnes_after)
    VALUES('RST-W','RST-P',10,'1.2345','2026-01-15 02:00:00',?,'B5D2-IN',100,110,'30.0000','31.2345')`,
    [confirmationId],
  );
  await db.run(
    `INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes,source_row_json)
    VALUES('RST-W','RST-P',110,'31.2345',?)`,
    [JSON.stringify({ stock_qty: 100, stock_weight: '30.0000' })],
  );
}
export async function appendDateCorrection(db: Database, revision = 1): Promise<void> {
  const first = revision === 1;
  await db.run(
    `INSERT INTO document_date_corrections(id,document_kind,document_id,previous_correction_id,
    before_date,after_date,reason,actor,operation_id,created_at,revision)
    VALUES(?,'inbound','B5D2-IN',?,?,?,'核对合成业务日期','owner',?,?,?)`,
    [
      first ? firstCorrectionId : '00000000-0000-4000-8000-000000000002',
      first ? null : firstCorrectionId,
      first ? '2026-01-15' : '2026-02-15',
      first ? '2026-02-15' : '2026-03-15',
      randomUUID(),
      first ? '2026-03-01 00:00:00' : '2026-04-01 00:00:00',
      revision,
    ],
  );
}
export function priorReportFields(result: { items: unknown[]; total: number; report: unknown }) {
  return JSON.parse(JSON.stringify({ items: result.items, total: result.total, report: result.report }));
}
