import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportFixture, waitExport, workbook } from './export-fixture.ts';
import { matchedRequest } from './b6b-export-test-helpers.ts';
import { actor } from './fixture.ts';

test('B6b Step 4 XLSX 与 CSV 将所有公式前缀按文本导出', async () => {
  const f = await exportFixture();
  const query = {
    keyword: 'WL-RK-000130',
    productCodes: 'WL-P000130',
    page: '1',
    pageSize: '50',
  };
  try {
    const formulas = ['=1+1', '+1+1', '-1+1', '@SUM(1)'];
    for (const formula of formulas) {
      await f.db.run('UPDATE inbound_lines SET product_name_snapshot=? WHERE id=?', [formula, '000130-R1']);
      const response = await f.api.get('/api/v1/web/lists/inbound').query(query).set('Cookie', f.cookie).expect(200);
      for (const format of ['xlsx', 'csv'] as const) {
        const input = matchedRequest(response.body.data, format);
        await f.service.create(input, actor);
        const job = await waitExport(f, input.requestId);
        assert.equal(job.state, 'ready', job.error ?? '');
        const file = await f.service.download(job.id);
        if (format === 'xlsx') {
          const { sheet } = await workbook(f, job.id);
          assert.equal(sheet.getCell('C2').value, formula);
          assert.equal(sheet.getCell('C2').formula, undefined);
        } else {
          assert.ok((await readFile(file.path, 'utf8')).includes("'" + formula));
        }
      }
    }
    console.log('B6B_STEP4_FORMULA prefixes==,+,-,@ xlsx=plain_text csv=apostrophe_escaped');
  } finally {
    await f.dispose();
  }
});
