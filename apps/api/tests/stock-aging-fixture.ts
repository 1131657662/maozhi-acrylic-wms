import { randomUUID } from 'node:crypto';
import { tonnes } from '@wms/contracts';
import type { Database } from '../src/db/mysql.ts';
import { normalizeEvent } from '../src/features/reports/normalize.ts';
import type { LedgerEvent } from '../src/features/reports/types.ts';

export const AGING_AS_OF = '2026-11-14T12:00:00.000Z';
export function agingEvent(overrides: Partial<LedgerEvent> = {}): LedgerEvent {
  return {
    ...normalizeEvent({
      id: 1,
      warehouseCode: 'DEMO-WH',
      productCode: 'AGING-P',
      productName: '库龄验收',
      operation_id: 'in-1',
      operation_type: 'inbound.confirm',
      packages_delta: 0,
      tonnes_delta: '1.0000',
      packages_before: 0,
      packages_after: 0,
      tonnes_before: '0.0000',
      tonnes_after: '1.0000',
      correctionOffsetTonnes: '0.0000',
      reportLocalTime: '2026-11-01 12:00:00',
    }),
    ...overrides,
  };
}

export async function agingCell(db: Database, product = `AGE-${randomUUID().slice(0, 8)}`, warehouse = 'DEMO-WH') {
  await db.run(
    `INSERT IGNORE INTO master_products(code,name,active,source_kind,origin_kind,inventory_eligible,created_at,updated_at)
    VALUES(?,'库龄验收商品',1,'local','local',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
    [product],
  );
  await db.run(`INSERT INTO stock(warehouse_code,product_code,packages,weight_tonnes) VALUES(?,?,0,'0.0000')`, [
    warehouse,
    product,
  ]);
  return { warehouseCode: warehouse, productCode: product };
}

export async function agingMovement(
  db: Database,
  cell: { warehouseCode: string; productCode: string },
  input: {
    before: number;
    delta: number;
    days?: number;
    type?: string;
    deleted?: number;
  },
) {
  const id = randomUUID(),
    after = input.before + input.delta;
  const clock = await db.get('SELECT UTC_TIMESTAMP(3) AS now');
  const when = new Date(String(clock!.now).replace(' ', 'T') + 'Z');
  when.setUTCDate(when.getUTCDate() - (input.days ?? 0));
  const stamp = when.toISOString().replace('T', ' ').slice(0, 23);
  await db.run(
    `INSERT INTO inventory_operations(id,operation_type,target_id,reason,actor,created_at)
    VALUES(?,?,?,'库龄合成验收','owner',?)`,
    [id, input.type ?? 'inbound.confirm', cell.productCode, stamp],
  );
  await db.run(
    `INSERT INTO stock_journal(operation_id,warehouse_code,product_code,packages_delta,tonnes_delta,
    packages_before,packages_after,tonnes_before,tonnes_after,source_del_flag,created_at)
    VALUES(?,?,?,0,?,0,0,?,?,?,?)`,
    [
      id,
      cell.warehouseCode,
      cell.productCode,
      tonnes(input.delta),
      tonnes(input.before),
      tonnes(after),
      input.deleted ?? 0,
      stamp,
    ],
  );
  if (!input.deleted)
    await db.run('UPDATE stock SET weight_tonnes=? WHERE warehouse_code=? AND product_code=?', [
      tonnes(after),
      cell.warehouseCode,
      cell.productCode,
    ]);
  return id;
}
