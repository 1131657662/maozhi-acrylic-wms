import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Database } from '../src/db/mysql.ts';
import type { Detail, FactInput } from '@wms/contracts';
import { actor } from './fixture.ts';
import { hash } from '../src/shared/hash.ts';
import { startHandoff } from '../src/features/handoff/start.ts';
import { registerRecords } from '../src/features/handoff/records.ts';
import { counted, postCommand } from './stocktake-fixture.ts';
import { shipmentFixture } from './multi-shipment-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';
import { postStocktake } from '../src/features/stocktake/post.ts';
import { AppError } from '../src/shared/errors.ts';

export async function partialStocktake() {
  const c = await shipmentFixture();
  try {
    await c.ship(20);
    await c.db.run("UPDATE outbound_orders SET created_at='2020-01-01' WHERE id=?", [c.order.id]);
    const preview = await counted(c.db, { packages: 179, weightGrams: 53700000 });
    return { ...c, preview };
  } catch (error) {
    await c.dispose();
    throw error;
  }
}

export async function registerPending(db: Database, order: Detail, facts: FactInput[]) {
  const records = facts.map((fact) => {
    const rawPayload = JSON.stringify(fact);
    return {
      planId: order.id,
      rawPayload,
      payloadSha: hash(rawPayload),
      localState: 'pending' as const,
      context: { outboundLineId: order.lines[0]!.id, sourceSpec: '合成规格', resolvedAt: null },
    };
  });
  const manifest = records
    .map((r, i) => [facts[i]!.id, r.planId, r.payloadSha])
    .sort((a, b) => a[0]!.localeCompare(b[0]!));
  const id = randomUUID();
  await startHandoff(
    db,
    {
      id,
      deviceId: facts[0]!.deviceId,
      appVersion: 'test',
      expectedCount: records.length,
      manifestSha: hash(JSON.stringify(manifest)),
      catalogVersion: 1,
      catalogSha: String(
        (await db.get('SELECT content_sha256 FROM catalog_versions WHERE version_id=1'))!.content_sha256,
      ),
      previousSessionHashes: [],
    },
    actor,
  );
  await registerRecords(db, id, records);
}

export async function rejectChecklist(db: Database, preview: Awaited<ReturnType<typeof counted>>) {
  const before = await businessFingerprint(db);
  const command = postCommand(preview);
  command.input.acknowledgeSnapshotBasis = true;
  await assert.rejects(
    postStocktake(db, command),
    (error) =>
      error instanceof AppError &&
      error.status === 409 &&
      error.code === 'STALE_STOCKTAKE_PREVIEW' &&
      error.message === '清单已变化，请重新核对',
  );
  assert.deepEqual(await businessFingerprint(db), before);
}
