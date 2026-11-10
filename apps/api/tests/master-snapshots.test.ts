import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { listFields, listCellText, type ExportRequest } from '@wms/contracts';
import { exportFixture, waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';
import { createInbound } from '../src/features/inbound/create.ts';
import { newReceipt } from './numbering-fixture.ts';
import { getInbound } from '../src/features/inbound/repository.ts';
import { listWebInbound } from '../src/features/web-lists/inbound.ts';
import { webInboundQuerySchema } from '@wms/contracts';

test('B6a 新单冻结名称型号，历史缺失在详情列表XLSX均历史未记录', async () => {
  const c = await exportFixture(1);
  try {
    await c.db.run("UPDATE master_products SET model='旧型号' WHERE code='ACR-032'");
    const doc = await createInbound(c.db, newReceipt(), randomUUID(), actor);
    await c.db.run("UPDATE master_products SET name='新商品名',model='新型号' WHERE code='ACR-032'");
    await c.db.run("UPDATE master_suppliers SET name='新供应商名' WHERE code='DEMO-SUPPLIER'");
    const detail = await getInbound(c.db, doc.id),
      query = webInboundQuerySchema.parse({ keyword: doc.receiptNo });
    const list = await listWebInbound(c.db, query);
    assert.equal(detail.supplierName, '合成供应商');
    assert.equal(detail.lines[0]!.productModel, '旧型号');
    assert.deepEqual(list.items[0]!.products, ['腈纶原料 · 合成样本']);
    assert.deepEqual(list.items[0]!.productModels, ['旧型号']);
    // This disposable fixture represents an old document lacking any new snapshots.
    await c.db.run(
      "UPDATE inbound_receipts SET supplier_name_snapshot=NULL,warehouse_name_snapshot=NULL WHERE id='WL-R000000'",
    );
    const old = await getInbound(c.db, 'WL-R000000');
    assert.equal(old.supplierName, '历史未记录');
    assert.equal(old.lines[0]!.productName, '历史未记录');
    const params = { keyword: 'WL-RK-', sortBy: 'receiptNo', direction: 'asc' };
    const page = (await c.api.get('/api/v1/web/lists/inbound').set('Cookie', c.cookie).query(params).expect(200)).body
      .data;
    const columns = [
      'supplierName',
      'warehouseName',
      'products',
      'productModels',
      'deliveryName',
      'deliveryPhone',
      'deliveryAddress',
    ];
    for (const key of columns)
      assert.equal(
        listCellText(
          'inbound',
          listFields.inbound.find((f) => f.key === key)!,
          page.items[0],
        ),
        key === 'products' || key === 'productModels' ? '历史未记录；历史未记录' : '历史未记录',
      );
    const input: ExportRequest = {
      requestId: randomUUID(),
      kind: 'inbound',
      scope: 'all',
      query: params,
      columns: ['receiptNo', ...columns],
      selected: [],
      viewToken: page.viewToken,
    };
    const job = await c.service.create(input, actor);
    assert.equal((await waitExport(c, job.id)).state, 'ready');
    const { sheet } = await workbook(c, job.id);
    const cells = columns.map((_, i) => sheet.getRow(2).getCell(i + 2).text);
    assert.deepEqual(
      cells,
      columns.map((key) =>
        listCellText(
          'inbound',
          listFields.inbound.find((f) => f.key === key)!,
          page.items[0],
        ),
      ),
    );
    console.log(
      'B6A_SNAPSHOT_THREE_SURFACES',
      JSON.stringify({
        newSnapshot: {
          supplier: detail.supplierName,
          product: detail.lines[0]!.productName,
          model: detail.lines[0]!.productModel,
        },
        oldDetail: { supplier: old.supplierName, product: old.lines[0]!.productName },
        list: columns.map((key) =>
          listCellText(
            'inbound',
            listFields.inbound.find((f) => f.key === key)!,
            page.items[0],
          ),
        ),
        xlsx: cells,
      }),
    );
  } finally {
    await c.dispose();
  }
});
