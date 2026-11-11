import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { billTypeText, listCellText, listFields, snapshotText, type ExportRequest } from '@wms/contracts';
import { createInbound } from '../src/features/inbound/create.ts';
import { getInbound } from '../src/features/inbound/repository.ts';
import { createOutboundPlan, editOutboundPlan } from '../src/features/outbound/plans.ts';
import { getOrder } from '../src/features/outbound/repository.ts';
import { actor, fixture } from './fixture.ts';
import { exportFixture, waitExport, workbook } from './export-fixture.ts';

async function createHistoricalDetails(context: Awaited<ReturnType<typeof fixture>>) {
  const inbound = await createInbound(
    context.db,
    {
      receiptNo: 'B4E-HISTORY-IN',
      supplierCode: 'DEMO-SUPPLIER',
      warehouseCode: 'DEMO-WH',
      lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 100000 }],
    },
    randomUUID(),
    actor,
  );
  const outbound = await createOutboundPlan(
    context.db,
    {
      orderNo: 'B4E-HISTORY-OUT',
      customerCode: 'DEMO-CUST-1',
      warehouseCode: 'DEMO-WH',
      vehicleNo: 'B4E-HISTORY',
      lines: [{ productCode: 'ACR-032', plannedPackages: 1, plannedWeightGrams: 100000 }],
    },
    randomUUID(),
    actor,
  );
  await context.db.run('UPDATE inbound_receipts SET bill_type=NULL,container_no=NULL WHERE id=?', [inbound.id]);
  await context.db.run('UPDATE inbound_lines SET memo=NULL WHERE receipt_id=?', [inbound.id]);
  await context.db.run('UPDATE outbound_orders SET bill_type=NULL,container_no=NULL WHERE id=?', [outbound.id]);
  await context.db.run('UPDATE outbound_lines SET contract_no=NULL,memo=NULL WHERE order_id=?', [outbound.id]);
  return { inbound: await getInbound(context.db, inbound.id), outbound: await getOrder(context.db, outbound.id) };
}

test('B4e 历史 NULL 扩展字段详情显示历史未记录', async () => {
  const context = await fixture();
  try {
    const details = await createHistoricalDetails(context);
    assert.deepEqual(
      [details.inbound.billType, details.inbound.containerNo, details.inbound.lines[0]!.memo],
      [null, null, null],
    );
    assert.deepEqual(
      [
        details.outbound.billType,
        details.outbound.containerNo,
        details.outbound.lines[0]!.contractNo,
        details.outbound.lines[0]!.memo,
      ],
      [null, null, null, null],
    );
    assert.equal(billTypeText('inbound', details.inbound.billType), '历史未记录');
    assert.equal(billTypeText('outbound', details.outbound.billType), '历史未记录');
    assert.equal(snapshotText(details.inbound.containerNo), '历史未记录');
    assert.equal(snapshotText(details.outbound.lines[0]!.contractNo), '历史未记录');
    assert.equal(snapshotText(details.outbound.lines[0]!.memo), '历史未记录');
  } finally {
    await context.dispose();
  }
});

test('B4e 编辑省略类型时保留历史 NULL 和已有分类，不套用新建默认值', async () => {
  const context = await fixture();
  try {
    const { outbound } = await createHistoricalDetails(context);
    for (const billType of [null, 'sample']) {
      await context.db.run('UPDATE outbound_orders SET bill_type=? WHERE id=?', [billType, outbound.id]);
      const before = await getOrder(context.db, outbound.id);
      const after = await editOutboundPlan(
        context.db,
        before.id,
        {
          revision: before.revision,
          digest: before.digest,
          plan: { vehicleNo: 'B4E-改车牌' },
        },
        randomUUID(),
        actor,
      );
      assert.equal(after.billType, billType);
      assert.equal(after.containerNo, null);
      assert.equal(after.lines[0]!.contractNo, null);
      assert.equal(after.lines[0]!.memo, null);
    }
  } finally {
    await context.dispose();
  }
});

test('B4e XLSX 单据类型列与列表中文投影一致', async () => {
  const context = await exportFixture(0);
  try {
    const receipt = await createInbound(
      context.db,
      {
        receiptNo: 'B4E-EXPORT-RETURN',
        supplierCode: 'DEMO-SUPPLIER',
        warehouseCode: 'DEMO-WH',
        billType: 'return',
        lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 100000 }],
      },
      randomUUID(),
      actor,
    );
    const query = { keyword: receipt.receiptNo, billType: 'return', page: '1', pageSize: '50' };
    const response = await context.api
      .get('/api/v1/web/lists/inbound')
      .query(query)
      .set('Cookie', context.cookie)
      .expect(200);
    const row = response.body.data.items.find((item: { id: string }) => item.id === receipt.id)!;
    const typeField = listFields.inbound.find((field) => field.key === 'billType')!;
    const input: ExportRequest = {
      requestId: randomUUID(),
      kind: 'inbound',
      scope: 'all',
      query,
      columns: ['receiptNo', 'billType'],
      viewToken: response.body.data.viewToken,
      selected: [],
    };
    const running = await context.service.create(input, actor);
    const job = await waitExport(context, running.id);
    assert.equal(job.state, 'ready', job.error ?? '');
    const { sheet } = await workbook(context, job.id);
    assert.equal(sheet.getCell(1, 2).value, typeField.label);
    assert.equal(sheet.getCell(2, 2).value, listCellText('inbound', typeField, row));
    assert.equal(sheet.getCell(2, 2).value, '退货入库');
  } finally {
    await context.dispose();
  }
});
