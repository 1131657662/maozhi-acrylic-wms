import type { HandoffStart } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { handoffHeader } from './read.ts';

export async function startHandoff(db: Database, input: HandoffStart, actor: Actor) {
  return db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    const old = await tx.get('SELECT * FROM pda_handoffs WHERE id=?', [input.id]);
    if (old) {
      ensure(
        old.manifest_sha === input.manifestSha &&
          old.device_id === input.deviceId &&
          Number(old.expected_count) === input.expectedCount &&
          old.catalog_sha === input.catalogSha &&
          Number(old.catalog_version) === input.catalogVersion &&
          old.app_version === input.appVersion,
        'IDEMPOTENCY_CONFLICT',
        '交接编号已对应另一份队列',
      );
      return { id: input.id };
    }
    const version = await tx.get(
      "SELECT content_sha256 FROM catalog_versions WHERE version_id=? AND status='published'",
      [input.catalogVersion],
    );
    ensure(version?.content_sha256 === input.catalogSha, 'CATALOG_NOT_VERIFIED', '本机目录版本或校验摘要不符');
    await tx.run(
      `INSERT INTO pda_handoffs(id,device_id,app_version,expected_count,manifest_sha,catalog_version,catalog_sha,created_at)
      VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(3))`,
      [
        input.id,
        input.deviceId,
        input.appVersion,
        input.expectedCount,
        input.manifestSha,
        input.catalogVersion,
        input.catalogSha,
      ],
    );
    await associateClients(tx, input);
    await audit(tx, actor, {
      action: 'catalog.handoff.register',
      targetId: input.id,
      before: null,
      after: { deviceId: input.deviceId, count: input.expectedCount, manifestSha: input.manifestSha },
    });
    return { id: input.id };
  });
}
async function associateClients(db: Database, input: HandoffStart) {
  const key = `device:${input.deviceId}`;
  await db.run(
    `INSERT INTO catalog_client_activity(client_key,legacy_requests,queue_verified,last_seen_at)
    VALUES(?,0,0,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE client_key=client_key`,
    [key],
  );
  for (const clientKey of [key, ...input.previousSessionHashes.map((h) => `session:${h}`)]) {
    await db.run(
      `INSERT INTO pda_handoff_clients(handoff_id,client_key,observed_requests,observed_seen_at)
      SELECT ?,client_key,legacy_requests,last_seen_at FROM catalog_client_activity WHERE client_key=?`,
      [input.id, clientKey],
    );
  }
}
export async function checkHandoffDevice(db: Database, id: string, deviceId: string) {
  const h = await handoffHeader(db, id);
  ensure(h.device_id === deviceId, 'HANDOFF_DEVICE_MISMATCH', '交接设备不一致');
  return h;
}
