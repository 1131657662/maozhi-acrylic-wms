import { factInputSchema, scanContextInputSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { resolveContext } from '../scan/context.ts';
import { handoffHeader } from './read.ts';

export async function bindRecords(db: Database, id: string, factIds: string[], lineId: string, actor: Actor) {
  return db.transaction(async (tx) => {
    await tx.get("SELECT value FROM app_meta WHERE meta_key='identity' FOR UPDATE");
    ensure((await handoffHeader(tx, id)).confirmed_at === null, 'HANDOFF_SEALED', '交接已确认');
    for (const factId of new Set(factIds)) await bindOne(tx, id, factId, lineId);
    await audit(tx, actor, { action: 'catalog.handoff.bind', targetId: id, before: null, after: { factIds, lineId } });
    return { bound: new Set(factIds).size };
  });
}
async function bindOne(db: Database, id: string, factId: string, lineId: string) {
  const r = await db.get('SELECT * FROM pda_handoff_records WHERE handoff_id=? AND fact_id=?', [id, factId]);
  ensure(r, 'NOT_FOUND', '清单中没有该事实');
  if (r.context_json !== null) {
    ensure(
      scanContextInputSchema.parse(JSON.parse(String(r.context_json))).outboundLineId === lineId,
      'HANDOFF_CONTEXT_SEALED',
      '事实已有上下文，禁止重新绑定',
    );
    return;
  }
  const fact = factInputSchema.parse(JSON.parse(String(r.raw_payload)));
  const entry = await db.get('SELECT source_spec FROM catalog_entries WHERE version_id=? AND barcode=?', [
    fact.catalogVersion,
    fact.barcode,
  ]);
  const context = {
    outboundLineId: lineId,
    sourceSpec: entry?.source_spec === null ? null : String(entry?.source_spec ?? ''),
    resolvedAt: null,
  };
  await resolveContext(db, { planId: String(r.plan_id), fact, context });
  await db.run(
    'UPDATE pda_handoff_records SET context_json=? WHERE handoff_id=? AND fact_id=? AND context_json IS NULL',
    [JSON.stringify(context), id, factId],
  );
}
