import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalog } from '../src/features/catalog/parse.ts';
import { contentHash } from '../src/features/catalog/hash.ts';
import { CATALOG_ERROR_MAX_ROWS, catalogExportCopy } from '@wms/contracts';

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
test('目录解析一次收集三条错误并保留截断原始行', () => {
  assert.throws(
    () => parseCatalog(Buffer.from('规格 A nope\n规格 B 0\n坏行'), 'utf-8'),
    (error: unknown) => {
      assert.equal((error as { status: number }).status, 422);
      assert.deepEqual((error as { data: unknown }).data, {
        errors: [
          { line: 1, raw: '规格 A nope', reason: '重量必须为正十进制 千克' },
          { line: 2, raw: '规格 B 0', reason: '重量为零、负数或超出支持范围' },
          { line: 3, raw: '坏行', reason: '缺少规格、条码或重量' },
        ],
        truncated: false,
      });
      return true;
    },
  );
});
test('目录解析最多返回500条错误并报告截断', () => {
  const invalidRows = Array.from({ length: CATALOG_ERROR_MAX_ROWS + 1 }, (_, index) => `规格 A-${index} 0`).join('\n');
  assert.throws(
    () => parseCatalog(Buffer.from(invalidRows), 'utf-8'),
    (error: unknown) => {
      const data = (error as { data: { errors: unknown[]; truncated: boolean } }).data;
      assert.equal(data.errors.length, CATALOG_ERROR_MAX_ROWS);
      assert.equal(data.truncated, true);
      assert.equal((error as { message: string }).message, catalogExportCopy.tooManyErrors);
      return true;
    },
  );
});
test('目录解析错误行内容按200个Unicode字符截断', () => {
  assert.throws(
    () => parseCatalog(Buffer.from(`${'🧶'.repeat(201)}\n`), 'utf-8'),
    (error: unknown) => {
      const data = (error as { data: { errors: { raw: string }[] } }).data;
      assert.equal([...data.errors[0]!.raw].length, 200);
      return true;
    },
  );
});
