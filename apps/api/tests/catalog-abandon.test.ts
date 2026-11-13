import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { actor, catalogFixture, catalogSnapshot, upload, publish } from './catalog-fixture.ts';
import { abandonCandidate } from '../src/features/catalog/abandon.ts';
import { getVersion } from '../src/features/catalog/repository.ts';
import { rebuildCandidate } from '../src/features/catalog/rebuild.ts';
import { uploadCatalog } from '../src/features/catalog/upload.ts';
import { uploadResult } from '../src/features/catalog/read.ts';
import { traceCatalogBarcode } from '../src/features/catalog/query.ts';
import { candidateHandoffs } from '../src/features/catalog/candidate-handoffs.ts';
import { prepareHandoff } from './handoff-fixture.ts';
import { startHandoff } from '../src/features/handoff/start.ts';
import { publishCatalog } from '../src/features/catalog/publish.ts';

const command = (versionId: number) => ({ versionId, reason: '合成验收：该文件不发布', key: randomUUID(), actor });

test('整版放弃可查证据；同键重放，新键重复422，发布422，原文/库存/扫码不变', async () => {
  const c = await catalogFixture();
  try {
    const version = (await upload(c.db, '规格 ABANDON-1 300')).version!;
    const before = await catalogSnapshot(c.db),
      input = command(version.versionId);
    const result = await abandonCandidate(c.db, input);
    assert.deepEqual(await abandonCandidate(c.db, input), result);
    await assert.rejects(abandonCandidate(c.db, command(version.versionId)), { status: 422 });
    await assert.rejects(abandonCandidate(c.db, { ...input, reason: '不同原因' }), { code: 'IDEMPOTENCY_CONFLICT' });
    await assert.rejects(publish(c.db, version.versionId), { status: 422, message: '该候选已放弃，请重建候选' });
    await assert.rejects(
      publishCatalog(c.db, { ...input, baseRevision: 999, contentSha256: version.contentSha256, enabled: false }),
      { status: 422, message: '该候选已放弃，请重建候选' },
    );
    const updated = await getVersion(c.db, version.versionId);
    assert.equal(updated.status, 'abandoned');
    assert.equal(updated.abandonment?.reason, input.reason);
    assert.equal(updated.abandonment?.actor, actor.username);
    assert.ok(updated.abandonment?.createdAt);
    const after = await catalogSnapshot(c.db);
    for (const table of Object.keys(before).filter(
      (name) => !['operation_log', 'idempotent_commands', 'catalog_candidate_abandons'].includes(name),
    ))
      assert.deepEqual(after[table], before[table], table);
    assert.equal(
      Number((await c.db.get("SELECT COUNT(*) AS n FROM operation_log WHERE action='catalog.abandon'"))?.n),
      1,
    );
    assert.equal((await traceCatalogBarcode(c.db, 'ABANDON-1')).versions[0]?.status, 'abandoned');
  } finally {
    await c.dispose();
  }
});

test('已发布版本不可放弃', async () => {
  const c = await catalogFixture();
  try {
    await assert.rejects(abandonCandidate(c.db, command(1)), { status: 422, code: 'CATALOG_NOT_ABANDONABLE' });
  } finally {
    await c.dispose();
  }
});

test('同内容重传返回已放弃版且不新建；原上传重试与查询反映最新状态', async () => {
  const c = await catalogFixture();
  try {
    const input = {
      bytes: Buffer.from('规格 SAME-1 300'),
      encoding: 'utf-8',
      fileName: 'sku.txt',
      key: randomUUID(),
      actor,
    };
    const original = await uploadCatalog(c.db, input);
    const priorDuplicateInput = { ...input, key: randomUUID() };
    const priorDuplicate = await uploadCatalog(c.db, priorDuplicateInput);
    assert.equal(priorDuplicate.version, null);
    assert.equal(priorDuplicate.message, `与第 ${original.version!.versionId} 版内容一致`);
    await abandonCandidate(c.db, command(original.version!.versionId));
    const duplicate = await upload(c.db, '规格 SAME-1 300\r\n');
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.version?.status, 'abandoned');
    assert.equal(duplicate.matchedVersionId, original.version!.versionId);
    assert.match(duplicate.message, /已放弃/);
    assert.equal(
      duplicate.message,
      `与第 ${original.version!.versionId} 版内容一致，该候选已放弃；如需重新处理，请显式重建候选`,
    );
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM catalog_versions'))?.n), 2);
    assert.equal((await uploadCatalog(c.db, input)).version?.status, 'abandoned');
    assert.equal((await uploadResult(c.db, input.key, actor.username)).version?.status, 'abandoned');
    for (const replayed of [
      await uploadCatalog(c.db, priorDuplicateInput),
      await uploadResult(c.db, priorDuplicateInput.key, actor.username),
    ]) {
      assert.equal(replayed.version?.status, 'abandoned');
      assert.equal(replayed.message, duplicate.message);
      assert.equal(replayed.matchedVersionId, original.version!.versionId);
    }
  } finally {
    await c.dispose();
  }
});

test('显式重建生成新版本和当前基准；旧放弃记录保留，重建同键仅一次', async () => {
  const c = await catalogFixture();
  try {
    const old = (await upload(c.db, '规格 REBUILD-1 300')).version!;
    await abandonCandidate(c.db, command(old.versionId));
    const other = (await upload(c.db, '规格 OTHER-1 310')).version!;
    await publish(c.db, other.versionId);
    const before = await c.db.all('SELECT * FROM catalog_candidate_abandons');
    const input = { versionId: old.versionId, key: randomUUID(), actor };
    const rebuilt = await rebuildCandidate(c.db, input);
    assert.deepEqual(await rebuildCandidate(c.db, input), rebuilt);
    assert.ok(rebuilt.version!.versionId > other.versionId);
    assert.equal(rebuilt.version!.baseVersionId, other.versionId);
    assert.equal(rebuilt.version!.status, 'validated');
    assert.equal(rebuilt.version!.abandonment, null);
    assert.deepEqual(await c.db.all('SELECT * FROM catalog_candidate_abandons'), before);
    await publish(c.db, rebuilt.version!.versionId);
  } finally {
    await c.dispose();
  }
});

test('基准版本交接投影只读且隔离其他版本；放弃不扣减预期数', async () => {
  const c = await catalogFixture();
  try {
    const h = await prepareHandoff(c.db);
    await startHandoff(c.db, h.header, actor);
    const version = (await upload(c.db, '规格 EVIDENCE-1 300')).version!;
    const query = { versionId: version.versionId, page: 1 };
    const snapshot = await catalogSnapshot(c.db),
      evidence = await candidateHandoffs(c.db, query);
    assert.deepEqual(await catalogSnapshot(c.db), snapshot);
    assert.equal(evidence.baseVersionId, 1);
    assert.equal(evidence.total, 1);
    assert.equal(evidence.items[0]?.expectedCount, 60);
    assert.equal(evidence.items[0]?.unresolved, 60);
    assert.equal((await candidateHandoffs(c.db, { versionId: 1, page: 1 })).total, 0);
    await abandonCandidate(c.db, command(version.versionId));
    assert.deepEqual(await candidateHandoffs(c.db, query), evidence);
    const after = await catalogSnapshot(c.db);
    for (const table of [
      'scan_facts',
      'scan_fact_context',
      'stock',
      'stock_journal',
      'pda_handoffs',
      'pda_handoff_records',
    ])
      assert.deepEqual(after[table], snapshot[table], table);
  } finally {
    await c.dispose();
  }
});

test('放弃/发布并发只能一种生效；不同候选放弃不阻断发布', async () => {
  const c = await catalogFixture();
  try {
    const first = (await upload(c.db, '规格 RACE-1 300')).version!;
    const results = await Promise.allSettled([
      abandonCandidate(c.db, command(first.versionId)),
      publish(c.db, first.versionId),
    ]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const status = (await getVersion(c.db, first.versionId)).status;
    assert.ok(['abandoned', 'published'].includes(status));
    const other = (await upload(c.db, '规格 RACE-2 300')).version!;
    await publish(c.db, other.versionId);
  } finally {
    await c.dispose();
  }
});

test('放弃审计写入失败时证据一起回滚，原键可恢复', async () => {
  const c = await catalogFixture();
  try {
    const v = (await upload(c.db, '规格 ROLLBACK-1 300')).version!;
    const input = command(v.versionId),
      before = await catalogSnapshot(c.db);
    await c.db.run(
      "CREATE TRIGGER abandon_fail BEFORE INSERT ON operation_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='injected audit failure'",
    );
    await assert.rejects(abandonCandidate(c.db, input), /injected audit failure/);
    assert.deepEqual(await catalogSnapshot(c.db), before);
    assert.equal(Number((await c.db.get('SELECT COUNT(*) AS n FROM catalog_candidate_abandons'))?.n), 0);
    await c.db.run('DROP TRIGGER abandon_fail');
    await abandonCandidate(c.db, input);
  } finally {
    await c.dispose();
  }
});
