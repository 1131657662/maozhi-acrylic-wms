import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { stocktakeCopy } from '@wms/contracts';
import { blindFixture, saveBlind, revealBlind, type BlindFixture } from './stocktake-blind-fixture.ts';

async function downloadedSheet(c: BlindFixture, kind: 'blank' | 'result') {
  const response = await c.web
    .get(`${c.base}/export?kind=${kind}`)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
      res.on('error', done);
    })
    .expect(200);
  assert.match(response.headers['cache-control'] ?? '', /no-store/);
  assert.match(response.headers['content-type'] ?? '', /spreadsheetml/);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(response.body).buffer);
  return book.worksheets[0]!;
}
for (const kind of ['blank', 'result'] as const) {
  test(`B6e-1 ${kind} 导出在揭示前无账面与差异列，揭示后与明盘列一致`, async () => {
    const c = await blindFixture();
    try {
      await saveBlind(c);
      const hidden = await downloadedSheet(c, kind);
      assert.deepEqual(
        Array.from({ length: hidden.columnCount }, (_, i) => hidden.getCell(1, i + 1).value),
        [
          stocktakeCopy.warehouse,
          stocktakeCopy.productCode,
          stocktakeCopy.productName,
          stocktakeCopy.actualPackages,
          stocktakeCopy.actualTonnes,
        ],
      );
      assert.equal(hidden.getCell(2, 4).value, kind === 'result' ? 5 : '');
      assert.equal(hidden.getCell(2, 5).value, kind === 'result' ? '1.5231' : '');
      assert.equal(hidden.columnCount, 5);
      assert.equal((await revealBlind(c)).status, 200);
      const visible = await downloadedSheet(c, kind);
      assert.equal(visible.columnCount, 9);
      assert.equal(visible.getCell(2, 4).value, 6);
      assert.equal(visible.getCell(2, 5).value, '1.8000');
      assert.equal(visible.getCell(2, 8).value, kind === 'result' ? -1 : '');
      assert.equal(visible.getCell(2, 9).value, kind === 'result' ? '-0.2769' : '');
    } finally {
      await c.dispose();
    }
  });
}
