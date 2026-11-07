import type { FactInput,Detail } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { catalogItem,catalogSql } from './catalog.ts';

export async function validateFact(db: Database, plan: Detail, fact: FactInput): Promise<void> {
  ensure(plan.status==='open','PLAN_CLOSED','计划已冻结或已确认，禁止新增扫码');
  ensure(Math.abs(Date.now()-Date.parse(fact.scannedAt))<7*86400000,'INVALID_SCAN_TIME','扫码时间超出本地试用的七天窗口');
  const row = await db.get(`${catalogSql} WHERE barcode=?`,[fact.barcode]);
  ensure(row,'UNKNOWN_BARCODE','条码不在当前合成目录中，不允许猜测商品或重量');
  const item = catalogItem(row);
  ensure(item.weightGrams===fact.weightGrams,'WEIGHT_MISMATCH','实重与目录不一致');
  const line = plan.lines.find((entry)=>entry.productCode===item.productCode);
  ensure(line,'PRODUCT_MISMATCH','商品不属于此计划');
  ensure(line.actualPackages<line.plannedPackages,'OVER_PICK','已达到计划包数，禁止超扫');
  ensure(!await db.get('SELECT id FROM scan_facts WHERE barcode=?',[fact.barcode]),
    'DUPLICATE_BARCODE','该条码已被其他事实记录');
}
