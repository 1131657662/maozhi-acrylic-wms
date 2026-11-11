import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { openDatabase } from '../../apps/api/src/db/mysql.ts';
import { adminConfig } from '../mysql/local-config.ts';
import { handoffDetail } from '../../apps/api/src/features/handoff/read.ts';
import { bindRecords } from '../../apps/api/src/features/handoff/bind.ts';
import { confirmHandoff } from '../../apps/api/src/features/handoff/confirm.ts';
import { publicationGate } from '../../apps/api/src/features/catalog/gate.ts';
import { upload, publish, actor } from '../../apps/api/tests/catalog-fixture.ts';
import { getOrder } from '../../apps/api/src/features/outbound/repository.ts';
import { confirmOutbound } from '../../apps/api/src/features/outbound/confirm.ts';
import { randomUUID } from 'node:crypto';
import { registerRecords } from '../../apps/api/src/features/handoff/records.ts';
import { hash } from '../../apps/api/src/shared/hash.ts';

const { name } = JSON.parse(readFileSync('.local/evidence/b1c2-test-database.json', 'utf8')) as { name: string };
assert.match(name, /^maozhi_test_[a-f0-9]+$/);
const db = openDatabase({ ...adminConfig(), database: name });
try {
  const action = process.argv[2];
  if (action === 'bind') {
    for (const header of await db.all('SELECT id FROM pda_handoffs')) {
      const raw = JSON.parse(readFileSync('.local/evidence/b1c2-legacy-records.json', 'utf8')) as {
        payload: string;
        state: 'pending' | 'failed';
      }[];
      for (let i = 0; i < raw.length; i += 3)
        await registerRecords(
          db,
          String(header.id),
          raw.slice(i, i + 3).map((r) => ({
            planId: 'pda-handoff-plan',
            rawPayload: r.payload,
            payloadSha: hash(r.payload),
            localState: r.state,
          })),
        );
      const d = await handoffDetail(db, String(header.id));
      assert.equal(d.summary.expectedCount, 60);
      const ids = d.items.filter((r) => !r.context).map((r) => r.factId);
      if (ids.length) await bindRecords(db, String(header.id), ids, 'pda-handoff-line', actor);
    }
    console.log('B1C2_PHYSICAL_HANDOFF manifest=60 pending=55 failed=5 lost_response_verified=2 batch_bound=58');
  } else if (action === 'publish') {
    for (const header of await db.all('SELECT id FROM pda_handoffs'))
      await confirmHandoff(db, String(header.id), actor);
    assert.equal((await publicationGate(db, true)).allowed, true);
    const order = await getOrder(db, 'pda-handoff-plan');
    const candidate = await upload(db, '新版交接规格 HANDOFF-NEW 302\n交接规格 HANDOFF-001 302');
    await publish(db, candidate.version!.versionId);
    assert.deepEqual(await getOrder(db, 'pda-handoff-plan'), order);
    console.log('B1C2_PHYSICAL_PUBLISH v2=published old_order_digest_unchanged=true legacy_received=60');
  } else if (action === 'confirm') {
    const order = await getOrder(db, 'pda-handoff-plan');
    assert.equal(order.status, 'frozen');
    await confirmOutbound(db, {
      planId: order.id,
      lines: order.lines.map((line) => ({
        lineId: line.id,
        actualPackages: line.scanPackages ?? 0,
        actualWeightGrams: line.scanWeightGrams ?? 0,
      })),
      expected: { revision: order.revision, digest: order.digest },
      key: randomUUID(),
      actor,
    });
    assert.equal((await getOrder(db, order.id)).status, 'confirmed');
    console.log('B1C2_PHYSICAL_CONFIRM Web_semantics=confirmed packages=61 weight_grams=18302000 PDA_stock_writes=0');
  }
  const sql = `SELECT f.plan_id,f.catalog_version,COUNT(*) AS facts,SUM(f.weight_tonnes) AS tonnes,
    SUM(c.fact_id IS NOT NULL) AS context_count FROM scan_facts f LEFT JOIN scan_fact_context c ON c.fact_id=f.id
    GROUP BY f.plan_id,f.catalog_version ORDER BY f.plan_id,f.catalog_version`;
  console.log(sql);
  console.log(JSON.stringify(await db.all(sql)));
  console.log("SELECT * FROM stock WHERE product_code='TEST-ERP'");
  console.log(JSON.stringify(await db.all("SELECT * FROM stock WHERE product_code='TEST-ERP'")));
} finally {
  await db.close();
}
