import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import { XlsxWriter } from '../src/features/web-exports/writer.ts';

test('XLSX下载接收端断开后drain和finish都及时失败', { timeout: 5000 }, async () => {
  const output = new Writable({
    write(_chunk, _encoding, callback) {
      this.destroy();
      callback();
    },
  });
  const closed = once(output, 'close');
  const writer = new XlsxWriter({
    stream: output,
    fields: [{ key: 'barcode', label: '条码', width: 28, type: 'text' }],
  });
  writer.append({ barcode: '001ABC' });
  await closed;
  await assert.rejects(writer.drain());
  await assert.rejects(writer.finish(1));
  await writer.abort();
});
