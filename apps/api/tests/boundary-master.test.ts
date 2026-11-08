import test from 'node:test';
import assert from 'node:assert/strict';
import { masterPageSchema } from '@wms/contracts';
import { numberingFixture } from './numbering-fixture.ts';

test('B4a R3 四类主数据各605条，分页无重漏、末条可达、名称/编码搜索与精确回显', async () => {
  const f = await numberingFixture();
  try {
    for (const catalog of ['products', 'warehouses', 'customers', 'suppliers']) {
      const rows = Array.from({ length: 605 }, (_, i) => [`B4A-${String(i + 1).padStart(4, '0')}`, `资料-${i + 1}`]);
      await f.db.run(
        `INSERT INTO master_${catalog}(code,name,created_at,updated_at${catalog === 'products' ? ',source_kind' : ''}) VALUES ${rows.map(() => `(?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)${catalog === 'products' ? ",'erp-product'" : ''})`).join(',')}`,
        rows.flat(),
      );
      const all: string[] = [];
      for (let page = 1; page <= 4; page++) {
        const data = masterPageSchema.parse(
          (
            await f.web
              .get(`/api/v1/master-data/${catalog}`)
              .query({ keyword: 'B4A-', pageSize: 200, page })
              .expect(200)
          ).body.data,
        );
        assert.equal(data.total, 605);
        assert.equal(data.items.length, page === 4 ? 5 : 200);
        all.push(...data.items.map((row) => row.code));
      }
      assert.deepEqual(
        all,
        rows.map((row) => row[0]),
      );
      for (const keyword of ['B4A-0605', '资料-605']) {
        const data = (await f.web.get(`/api/v1/master-data/${catalog}`).query({ keyword }).expect(200)).body.data;
        assert.equal(data.total, 1);
        assert.equal(data.items[0].code, 'B4A-0605');
      }
      await f.db.run(`UPDATE master_${catalog} SET active=0 WHERE code='B4A-0605'`);
      const selected = (await f.web.get(`/api/v1/master-data/${catalog}/B4A-0605`).expect(200)).body.data;
      assert.equal(selected.name, '资料-605');
      assert.equal(selected.active, false);
      const active = (
        await f.web.get(`/api/v1/master-data/${catalog}`).query({ keyword: 'B4A-', status: 'active' }).expect(200)
      ).body.data;
      assert.equal(active.total, 604);
      const escaped = (await f.web.get(`/api/v1/master-data/${catalog}`).query({ keyword: "%' OR 1=1 --" }).expect(200))
        .body.data;
      assert.equal(escaped.total, 0);
      await f.web.get(`/api/v1/master-data/${catalog}`).query({ pageSize: 501 }).expect(422);
      console.log(
        'B4A_R3_PAGE',
        JSON.stringify({
          catalog,
          total: all.length,
          pageSizes: [200, 200, 200, 5],
          last: all.at(-1),
          selected,
          searchCode: 1,
          searchName: 1,
          active: active.total,
        }),
      );
    }
    const code = 'ERP.ODD/0606';
    await f.db.run(
      "INSERT INTO master_products(code,name,source_kind,created_at,updated_at) VALUES(?,'特殊编码','erp-product',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))",
      [code],
    );
    assert.equal(
      (await f.web.get(`/api/v1/master-data/products/${encodeURIComponent(code)}`).expect(200)).body.data.code,
      code,
    );
  } finally {
    await f.dispose();
  }
});
