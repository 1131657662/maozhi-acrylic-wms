import { createTestDatabase } from './mysql/test-database.ts';
import { seedFromSamples } from '../apps/api/src/db/seed.ts';
import { readSampleCsv, readSkuFile } from '../apps/api/src/db/sample-reader.ts';

const tables = ['product', 'inbound_order', 'inbound_order_detail', 'outbound_order',
  'outbound_order_detail', 'stock', 'stock_journal', 'supplier', 'customer', 'warehouse'] as const;
const localTables = { product: 'master_products', inbound_order: 'inbound_receipts', inbound_order_detail: 'inbound_lines',
  outbound_order: 'outbound_orders', outbound_order_detail: 'outbound_lines', stock: 'stock', stock_journal: 'stock_journal',
  supplier: 'master_suppliers', customer: 'master_customers', warehouse: 'master_warehouses' } as const;
const expected = { product: 428, inbound_order: 115, inbound_order_detail: 182, outbound_order: 415,
  outbound_order_detail: 544, stock: 122, stock_journal: 828, supplier: 2, customer: 376, warehouse: 3 };

const fixture = await createTestDatabase();
try {
  await seedFromSamples(fixture.db, 'sample-verification-password');
  const report = await verify(fixture.db);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await fixture.dispose();
}

async function verify(db: typeof fixture.db) {
  const counts = await countRows(db);
  const source = sourceTotals();
  const imported = await importedTotals(db);
  const barcode = await verifyBarcodes(db);
  return { sourceRows: expected, importedRows: counts, sourceTotals: source, importedTotals: imported, barcode };
}

async function countRows(db: typeof fixture.db) {
  const result: Record<string, { total: number; active: number; deleted: number }> = {};
  for (const table of tables) {
    const localTable = localTables[table];
    const sourceFilter = table === 'product' ? "WHERE source_kind='erp-product'" : '';
    const rows = await db.get(`SELECT COUNT(*) total, SUM(source_del_flag=0) active, SUM(source_del_flag=1) deleted FROM ${localTable} ${sourceFilter}`);
    result[table] = { total: Number(rows?.total), active: Number(rows?.active), deleted: Number(rows?.deleted) };
  }
  return result;
}

function sourceTotals() {
  const rows = (file: string) => readSampleCsv(file).filter((row) => row.del_flag === '0');
  return {
    stock: sum(rows('stock'), 'stock_qty', 'stock_weight'),
    inbound: sum(rows('inbound_order_detail'), 'inbound_qty', 'inbound_weight'),
    outbound: sum(rows('outbound_order_detail'), 'outbound_qty', 'outbound_weight'),
  };
}

async function importedTotals(db: typeof fixture.db) {
  const read = async (table: string, packages: string, tonnes: string) => {
    const row = await db.get(`SELECT SUM(${packages}) packages,SUM(${tonnes}) tonnes FROM ${table} WHERE source_del_flag=0`);
    return { packages: Number(row?.packages), tonnes: String(row?.tonnes) };
  };
  return { stock: await read('stock', 'packages', 'weight_tonnes'), inbound: await read('inbound_lines', 'packages', 'weight_tonnes'),
    outbound: await read('outbound_lines', 'planned_packages', 'planned_weight_tonnes') };
}

function sum(rows: Record<string, string | null>[], packages: string, tonnes: string) {
  let packageTotal = 0; let tonneTotal = 0;
  for (const row of rows) { packageTotal += Number(row[packages]); tonneTotal += Number(row[tonnes]); }
  return { packages: packageTotal, tonnes: tonneTotal.toFixed(4) };
}

async function verifyBarcodes(db: typeof fixture.db) {
  const source = readSkuFile();
  const rows = await db.all('SELECT barcode,weight_tonnes FROM scan_catalog ORDER BY barcode');
  const imported = new Map(rows.map((row) => [String(row.barcode), String(row.weight_tonnes)]));
  const mismatches = source.filter((row) => imported.get(row.barcode) !== kgToTonnes(row.weightKg));
  const sample = source.filter((_, index) => index % 901 === 0).slice(0, 10).map((row) => ({ barcode: row.barcode,
    sourceKg: row.weightKg, importedTonnes: imported.get(row.barcode), expectedTonnes: kgToTonnes(row.weightKg) }));
  return { sourceRows: source.length, catalogRows: rows.length, missing: source.filter((row) => !imported.has(row.barcode)).length,
    mismatches: mismatches.length, sample };
}

function kgToTonnes(value: string): string {
  const [whole, fraction = ''] = value.split('.');
  const scaled = BigInt(whole!) * 10n + BigInt(fraction.padEnd(1, '0'));
  return `${scaled / 10000n}.${(scaled % 10000n).toString().padStart(4, '0')}`;
}
