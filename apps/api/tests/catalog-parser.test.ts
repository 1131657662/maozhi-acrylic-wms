import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalog } from '../src/features/catalog/parse.ts';
import { contentHash } from '../src/features/catalog/hash.ts';

test('目录解析保留原规格、前导零、大小写与原 kg，十进制重量精确', () => {
  const items = parseCatalog(Buffer.from('规格  保留空格   001aB  389.500\r\n规格2  X-2  60\n'), 'utf-8');
  assert.equal(items[0]?.barcode, '001aB');
  assert.equal(items[0]?.sourceSpec, '规格  保留空格');
  assert.equal(items[0]?.weightGrams, 389500);
  assert.equal(items[0]?.rawWeightKg, '389.500');
  assert.equal(contentHash(items), contentHash([...items].reverse()));
});
for (const text of [
  '缺列',
  '规格 A nope',
  '规格 A 0',
  '规格 A -1',
  '规格 A 300.05',
  '规格 A 300\n规格 A 300',
  '规格 A 1000001',
  `规格 A ${'0'.repeat(64)}1`,
])
  test(`坏目录整版拒绝：${text.replaceAll('\n', ' / ')}`, () =>
    assert.throws(() => parseCatalog(Buffer.from(text), 'utf-8'), { code: 'CATALOG_FILE_INVALID', status: 422 }));
test('乱码与超限拒绝；明确空文件是零条快照', () => {
  assert.throws(() => parseCatalog(Buffer.from([0xff, 0xfe, 0x01]), 'utf-8'), { code: 'CATALOG_FILE_INVALID' });
  assert.throws(() => parseCatalog(Buffer.alloc(5 * 1024 * 1024 + 1), 'utf-8'), { status: 413 });
  assert.deepEqual(parseCatalog(Buffer.from(' \r\n'), 'utf-8'), []);
});
