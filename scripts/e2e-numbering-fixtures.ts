import type { Database } from '../apps/api/src/db/mysql.ts';
import { businessDate } from '../apps/api/src/features/document-numbering/repository.ts';

// Synthetic fixtures for the disposable E2E database only; never used by sample seeding.
export async function seedNumberingEvidence(db: Database): Promise<void> {
  const name = String((await db.get('SELECT DATABASE() AS name'))?.name);
  if (!/^maozhi_test_[a-f0-9]{24}$/.test(name)) throw new Error('E2E fixtures require a disposable test database');
  await db.run(
    `INSERT INTO outbound_orders(id,order_no,customer_name,customer_code,warehouse_code,vehicle_no,status,created_at)
    VALUES('E2E-UNKNOWN-OUT',?,'合成验收客户','DEMO-CUST-1','DEMO-WH','验收车辆','legacy_future_state',UTC_TIMESTAMP(3))`,
    [`CK-${businessDate()}-10`],
  );
  await db.run(`INSERT INTO inbound_receipts(id,receipt_no,supplier_code,warehouse_code,created_by,created_at,status)
    VALUES('E2E-UNKNOWN-IN','E2E-LEGACY-IN','DEMO-SUPPLIER','DEMO-WH','owner',UTC_TIMESTAMP(3),'legacy_inbound_state')`);
  await db.run(`INSERT INTO stock_journal(warehouse_code,product_code,packages_delta,tonnes_delta,created_at,source_business_type)
    VALUES('DEMO-WH','ACR-032',0,'0.0000',UTC_TIMESTAMP(3),'legacy_journal_type')`);
  await db.run("INSERT INTO document_number_rules(kind,sequence_width) VALUES('outbound',4)");
  await db.run("INSERT INTO document_number_counters(kind,date_key,last_sequence) VALUES('outbound',?,9)", [
    businessDate(),
  ]);
}
