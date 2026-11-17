import { RESTORE, backupBaselineSchema, type BackupBaseline } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { databaseTables, fingerprint, sqlIdentifier, tableFingerprint } from './baseline-tables.ts';

export async function captureBaseline(db: Database): Promise<BackupBaseline> {
  const names = await databaseTables(db),
    tables = [];
  for (const name of names) tables.push(await tableFingerprint(db, name));
  const inventory = await captureInventory(db);
  const migrations = await db.all('SELECT id,checksum,state FROM schema_migrations ORDER BY id');
  const documents = [...(await sampleDocuments(db, 'inbound')), ...(await sampleDocuments(db, 'outbound'))];
  return backupBaselineSchema.parse({
    version: 1,
    capturedAt: new Date().toISOString(),
    tableCount: tables.length,
    tables,
    inventory,
    migrations,
    documents,
  });
}
async function captureInventory(db: Database): Promise<BackupBaseline['inventory']> {
  const totals = await db.get(
    'SELECT COALESCE(SUM(packages),0) AS packages,COALESCE(SUM(weight_tonnes),0) AS tonnes FROM stock',
  );
  const cells = await db.all(
    'SELECT warehouse_code,product_code,packages,weight_tonnes FROM stock ORDER BY warehouse_code,product_code',
  );
  return {
    packages: String(totals?.packages),
    tonnes: String(totals?.tonnes),
    cells: cells.map((row) => ({
      warehouse: String(row.warehouse_code),
      product: String(row.product_code),
      packages: String(row.packages),
      tonnes: String(row.weight_tonnes),
    })),
  };
}
async function sampleDocuments(db: Database, kind: 'inbound' | 'outbound'): Promise<BackupBaseline['documents']> {
  const table = kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
  const lineTable = kind === 'inbound' ? 'inbound_lines' : 'outbound_lines';
  const parent = kind === 'inbound' ? 'receipt_id' : 'order_id';
  const rows = await db.all(`SELECT * FROM ${sqlIdentifier(table)} ORDER BY id LIMIT ?`, [RESTORE.sampleDocuments]);
  const result: BackupBaseline['documents'] = [];
  for (const row of rows) {
    const lines = await db.all(
      `SELECT * FROM ${sqlIdentifier(lineTable)} WHERE ${sqlIdentifier(parent)}=? ORDER BY id`,
      [String(row.id)],
    );
    result.push({
      kind,
      number: String(row[kind === 'inbound' ? 'receipt_no' : 'order_no']),
      fingerprint: fingerprint({ row, lines }),
    });
  }
  return result;
}
