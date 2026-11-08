import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { catalogFixture, upload, publish, actor, catalogSnapshot } from './catalog-fixture.ts';
import { head, getVersion } from '../src/features/catalog/repository.ts';
import { publishCatalog } from '../src/features/catalog/publish.ts';
import { uploadCatalog } from '../src/features/catalog/upload.ts';
import { noteLegacyClient, publicationGate } from '../src/features/catalog/gate.ts';
import { versionEntries } from '../src/features/catalog/read.ts';

test('重复内容匹配历史版，默认版本数不增加；显式二次确认才重建', async () => {
  const { db, dispose } = await catalogFixture();
  try {
    const first = await upload(db, '规格 A 300');
    const v = first.version!;
    await publish(db, v.versionId);
    const second = await upload(db, '规格 A 300\r\n');
    assert.equal(second.duplicate, true);
    assert.equal(second.message, `与第 ${v.versionId} 版内容一致`);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM catalog_versions'))?.n), 2);
    const next = await upload(db, '规格 B 302');
    await publish(db, next.version!.versionId);
    const again = await upload(db, '规格 A 300');
    assert.equal(again.matchedVersionId, v.versionId);
    const rebuilt = await upload(db, '规格 A 300', v.versionId);
    assert.equal(rebuilt.duplicate, false);
    await assert.rejects(upload(db, '规格 BAD 300', v.versionId), { code: 'CATALOG_REBUILD_MISMATCH' });
    console.log(
      `B1C1_DUPLICATE message=${second.message} versions_before=2 versions_after=2 explicit_rebuild=${rebuilt.version!.versionId}`,
    );
  } finally {
    await dispose();
  }
});
test('上传和发布同键重放；并发 base 只有一份生效；固定版本分页不混版', async () => {
  const { db, dispose } = await catalogFixture();
  try {
    const command = {
      bytes: Buffer.from('规格 A 300\n规格 B 302'),
      fileName: 'sku.txt',
      encoding: 'utf-8',
      key: randomUUID(),
      actor,
    };
    const [a, b] = await Promise.all([uploadCatalog(db, command), uploadCatalog(db, command)]);
    assert.deepEqual(a, b);
    const c = await upload(db, '规格 C 300');
    const results = await Promise.allSettled([publish(db, a.version!.versionId), publish(db, c.version!.versionId)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const active = (await head(db))!;
    const version = await getVersion(db, active.versionId);
    const replay = {
      versionId: version.versionId,
      baseRevision: version.baseRevision,
      contentSha256: version.contentSha256,
      key: randomUUID(),
      actor,
      enabled: true,
    };
    await assert.rejects(publishCatalog(db, replay), { code: 'CATALOG_BASE_CHANGED' });
    const page = await versionEntries(db, { versionId: 1, after: '', limit: 1 });
    assert.equal(page.items[0]?.catalogVersion, 1);
    console.log(`B1C1_PUBLISH_RACE fulfilled=1 head=${active.versionId} legacy_page_version=1`);
  } finally {
    await dispose();
  }
});
test('发布开关、旧协议计数和未核实设备队列都阻止发布', async () => {
  const { db, dispose } = await catalogFixture();
  try {
    const candidate = (await upload(db, '规格 A 300')).version!;
    assert.equal((await publicationGate(db, false)).allowed, false);
    await noteLegacyClient(db, 'device:legacy-test');
    const before = await catalogSnapshot(db);
    await assert.rejects(publish(db, candidate.versionId), { code: 'CATALOG_PUBLISH_BLOCKED' });
    assert.deepEqual(await catalogSnapshot(db), before);
    const gate = await publicationGate(db, true);
    assert.equal(gate.legacyRequests, 1);
    assert.equal(gate.allowed, false);
    console.log(`B1C1_GATE ${JSON.stringify(gate)}`);
  } finally {
    await dispose();
  }
});
