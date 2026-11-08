import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { outstandingClientsSql } from '../handoff/read.ts';

export async function publicationGate(db: Database, enabled: boolean) {
  const reasons: string[] = [];
  if (!enabled) reasons.push('目录发布尚未开放：须先完成设备及待补传队列清点');
  const migration = await db.get("SELECT state FROM schema_migrations WHERE id='006_catalog_versioning'");
  if (migration?.state !== 'applied') reasons.push('目录迁移尚未完成');
  const missing = await db.get(
    'SELECT COUNT(*) AS n FROM scan_facts f LEFT JOIN scan_fact_context c ON c.fact_id=f.id WHERE c.fact_id IS NULL',
  );
  if (Number(missing?.n) > 0) reasons.push('存在尚未完成 ERP 归属核验的历史事实');
  const clients = await db.get(
    `SELECT COALESCE(SUM(legacy_requests),0) AS requests,COUNT(*) AS clients FROM (${outstandingClientsSql}) pending`,
  );
  const handoffs = await db.get('SELECT COUNT(*) AS n FROM pda_handoffs WHERE confirmed_at IS NULL');
  if (Number(handoffs?.n) > 0)
    reasons.push(`还有 ${Number(handoffs?.n)} 份设备交接清单待收妥和确认，请查看下方交接明细`);
  const legacyRequests = Number(clients?.requests ?? 0),
    unverifiedClients = Number(clients?.clients ?? 0);
  if (unverifiedClients)
    reasons.push(
      `发现 ${unverifiedClients} 个未交接旧协议客户端，旧协议请求 ${legacyRequests} 次；须核实并确认设备待补传队列，不能自动清零`,
    );
  return { allowed: reasons.length === 0, reasons, legacyRequests, unverifiedClients };
}
export async function noteLegacyClient(db: Database, key: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    await tx.run(
      `INSERT INTO catalog_client_activity(client_key,legacy_requests,queue_verified,last_seen_at)
      VALUES(?,1,0,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE legacy_requests=legacy_requests+1,last_seen_at=UTC_TIMESTAMP(3),queue_verified=0`,
      [key],
    );
  });
}
export async function assertPublicationGate(db: Database, enabled: boolean): Promise<void> {
  const gate = await publicationGate(db, enabled);
  ensure(gate.allowed, 'CATALOG_PUBLISH_BLOCKED', gate.reasons.join('；'));
}
