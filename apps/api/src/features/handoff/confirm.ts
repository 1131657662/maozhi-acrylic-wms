import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { handoffHeader, handoffRows, handoffSummary } from './read.ts';

export async function linkClient(db: Database, id: string, clientKey: string, actor: Actor) {
  return db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    const h = await handoffHeader(tx, id);
    ensure(h.confirmed_at === null, 'HANDOFF_SEALED', '交接已确认，请重新登记清单');
    const c = await tx.get('SELECT * FROM catalog_client_activity WHERE client_key=?', [clientKey]);
    ensure(c, 'NOT_FOUND', '没有此旧协议客户端');
    await tx.run(
      `INSERT INTO pda_handoff_clients(handoff_id,client_key,observed_requests,observed_seen_at)
      VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE observed_requests=VALUES(observed_requests),observed_seen_at=VALUES(observed_seen_at)`,
      [id, clientKey, Number(c.legacy_requests), String(c.last_seen_at)],
    );
    await audit(tx, actor, {
      action: 'catalog.handoff.link',
      targetId: id,
      before: null,
      after: { clientKey, deviceId: h.device_id },
    });
    return { linked: true };
  });
}
export async function confirmHandoff(db: Database, id: string, actor: Actor) {
  return db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    const h = await handoffHeader(tx, id);
    if (h.confirmed_at !== null) return { confirmed: true };
    const summary = handoffSummary(h, await handoffRows(tx, id));
    ensure(summary.ready, 'HANDOFF_INCOMPLETE', summary.reasons.join('；'));
    const changed = await tx.get(
      `SELECT COUNT(*) AS n FROM pda_handoff_clients c
      JOIN catalog_client_activity a ON a.client_key=c.client_key WHERE c.handoff_id=?
      AND (a.legacy_requests<>c.observed_requests OR a.last_seen_at<>c.observed_seen_at)`,
      [id],
    );
    ensure(Number(changed?.n) === 0, 'HANDOFF_CLIENT_CHANGED', '清点后又有旧协议请求；请重新核验并关联客户端');
    await tx.run('UPDATE pda_handoffs SET confirmed_at=UTC_TIMESTAMP(3) WHERE id=?', [id]);
    await audit(tx, actor, { action: 'catalog.handoff.confirm', targetId: id, before: null, after: summary });
    return { confirmed: true };
  });
}
