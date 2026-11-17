import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { RESTORE } from '@wms/contracts';
import { guardedRestoreSql } from '../src/features/maintenance/restore-sql.ts';

async function collect(source: Readable): Promise<string> {
  const lines = [];
  for await (const line of guardedRestoreSql(source)) lines.push(line);
  return lines.join('');
}
test('B8c恢复兼容：慢导入背压下完整读取大批SQL行，不恢复已关闭读取器', async () => {
  const sql = "SELECT '腈纶';\n".repeat(5000);
  let actual = '';
  await pipeline(
    guardedRestoreSql(Readable.from([Buffer.from(sql)])),
    new Writable({
      highWaterMark: 1,
      write(chunk, _encoding, done) {
        actual += String(chunk);
        setImmediate(done);
      },
    }),
  );
  assert.equal(actual, sql);
});
test('B8c恢复兼容：跨块UTF8与CRLF保持正文，单独CR后跨库语句仍拒绝', async () => {
  const sql = "SELECT '腈纶\r\n仓';\rSELECT 1;\n";
  const chunks = [...Buffer.from(sql)].map((byte) => Buffer.from([byte]));
  assert.equal(await collect(Readable.from(chunks)), "SELECT '腈纶\n仓';\nSELECT 1;\n");
  await assert.rejects(
    collect(Readable.from(['-- comment\rUSE other_database;'])),
    (error: { code?: string }) => error.code === 'RESTORE_CROSS_DATABASE',
  );
});
test('B8c恢复兼容：超长SQL行仍拒绝，不能借分块绕过上限', async () => {
  const source = Readable.from(['x'.repeat(RESTORE.maximumSqlLineBytes), 'x']);
  await assert.rejects(collect(source), (error: { code?: string }) => error.code === 'RESTORE_SQL_LIMIT');
});
