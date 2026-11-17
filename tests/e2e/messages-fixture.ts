import { randomUUID } from 'node:crypto';
import { e2eDatabase } from './inventory-helpers';
import { createInbound } from '../../apps/api/src/features/inbound/create';
import { createOutboundPlan } from '../../apps/api/src/features/outbound/plans';
import { createStocktake } from '../../apps/api/src/features/stocktake/create';
import { saveReading } from '../../apps/api/src/features/stocktake/save-reading';
import { scanMessages } from '../../apps/api/src/features/notifications/scan';
import { insertBackup } from '../../apps/api/src/features/maintenance/jobs';
import { newPlan, newReceipt } from '../../apps/api/tests/numbering-fixture';
import { oldTime } from '../../apps/api/tests/messages-scan-fixture';
import { actor } from '../../apps/api/tests/fixture';

export async function browserMessageSources() {
  const db = e2eDatabase();
  const warehouse = `MSG-${randomUUID().slice(0, 8)}`;
  await db.run(
    "INSERT INTO master_warehouses(code,name,active,created_at,updated_at) VALUES(?,'消息验收仓',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
    [warehouse],
  );
  const receipt = await createInbound(db, { ...newReceipt(), warehouseCode: warehouse }, randomUUID(), actor);
  const plan = await createOutboundPlan(db, { ...newPlan(), warehouseCode: warehouse }, randomUUID(), actor);
  const take = await createStocktake(db, { warehouseCode: warehouse, productCodes: ['ACR-032'] }, randomUUID(), actor);
  await saveReading(db, {
    id: take.id,
    productCode: 'ACR-032',
    input: { expectedRevision: 0, actual: { packages: 100, weightGrams: 30000000 } },
    key: randomUUID(),
    actor,
  });
  const now = new Date(Date.now() + 1000),
    job = await insertBackup(db, actor, randomUUID());
  const catalog = await db.get(
    'SELECT v.version_id,v.published_at FROM catalog_head h JOIN catalog_versions v ON v.version_id=h.active_version_id WHERE h.id=1',
  );
  await db.run('UPDATE inbound_receipts SET created_at=? WHERE id=?', [oldTime(now, 1), receipt.id]);
  await db.run('UPDATE outbound_orders SET scan_closed_at=? WHERE id=?', [oldTime(now, 8), plan.id]);
  await db.run('UPDATE stocktake_windows SET started_at=? WHERE stocktake_id=?', [oldTime(now, 2), take.id]);
  await db.run('UPDATE catalog_versions SET published_at=? WHERE version_id=?', [
    oldTime(now, 31),
    String(catalog!.version_id),
  ]);
  await db.run(
    "UPDATE maintenance_jobs SET status='failed',finished_at=UTC_TIMESTAMP(3),error='消息验收备份失败' WHERE id=?",
    [job],
  );
  await scanMessages(db, now);
  const messages = await db.all(
    'SELECT id,type,title,link_path FROM notifications WHERE resolved_at IS NULL AND object_id IN (?,?,?,?,?)',
    [receipt.id, plan.id, take.id, job, '1'],
  );
  await db.run('UPDATE catalog_versions SET published_at=? WHERE version_id=?', [
    String(catalog!.published_at),
    String(catalog!.version_id),
  ]);
  await db.run('UPDATE stocktake_windows SET released_at=UTC_TIMESTAMP(3) WHERE stocktake_id=?', [take.id]);
  await db.run("UPDATE stocktakes SET status='voided' WHERE id=?", [take.id]);
  return { db, messages };
}
