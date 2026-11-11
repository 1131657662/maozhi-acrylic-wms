import type { FactInput, Detail } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';

export async function validateFact(db: Database, plan: Detail, fact: FactInput, lineId: string): Promise<void> {
  ensure(Date.parse(fact.scannedAt) < Date.now() + 7 * 86400000, 'INVALID_SCAN_TIME', '扫码时间超出允许的未来时间范围');
  const line = plan.lines.find((entry) => entry.id === lineId);
  ensure(line, 'PRODUCT_MISMATCH', '商品不属于此计划');
  ensure(
    !(await db.get('SELECT id FROM scan_facts WHERE barcode=?', [fact.barcode])),
    'DUPLICATE_BARCODE',
    '该条码已被其他事实记录',
  );
}
