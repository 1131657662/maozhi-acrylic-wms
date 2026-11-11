import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import request from 'supertest';
import { listCellText, listFields } from '@wms/contracts';
import { createInbound } from '../src/features/inbound/create.ts';
import { confirmOutbound } from '../src/features/outbound/confirm.ts';
import { createOutboundPlan, editOutboundPlan } from '../src/features/outbound/plans.ts';
import { fixture, actor } from './fixture.ts';

const origin = 'http://127.0.0.1:5173';

test('B4e 类型默认值、非法类型 422、列表筛选和导出投影一致', async () => {
  const context = await fixture();
  try {
    const web = request.agent(context.app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    await web
      .post('/api/v1/inbound')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({
        receiptNo: 'B4E-IN-INVALID',
        supplierCode: 'DEMO-SUPPLIER',
        warehouseCode: 'DEMO-WH',
        billType: 'invalid',
        lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 100000 }],
      })
      .expect(422);
    await web
      .post('/api/v1/outbound')
      .set('Origin', origin)
      .set('Idempotency-Key', randomUUID())
      .send({
        customerCode: 'DEMO-CUST-1',
        warehouseCode: 'DEMO-WH',
        vehicleNo: 'B4E-TEST',
        billType: 'invalid',
        lines: [{ productCode: 'ACR-032', plannedPackages: 1, plannedWeightGrams: 100000 }],
      })
      .expect(422);

    const inbound = await createInbound(
      context.db,
      {
        receiptNo: 'B4E-IN-DEFAULT',
        supplierCode: 'DEMO-SUPPLIER',
        warehouseCode: 'DEMO-WH',
        containerNo: '柜-01',
        lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 100000, memo: '入库行备注' }],
      },
      randomUUID(),
      actor,
    );
    assert.equal(inbound.billType, 'purchase');
    assert.equal(inbound.containerNo, '柜-01');
    assert.equal(inbound.lines[0]?.memo, '入库行备注');

    const inboundReturn = await createInbound(
      context.db,
      {
        receiptNo: 'B4E-IN-RETURN',
        supplierCode: 'DEMO-SUPPLIER',
        warehouseCode: 'DEMO-WH',
        billType: 'return',
        lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 100000 }],
      },
      randomUUID(),
      actor,
    );
    const inboundList = await web.get('/api/v1/web/lists/inbound').query({ billType: 'return' }).expect(200);
    assert.deepEqual(
      inboundList.body.data.items.map((row: { id: string }) => row.id),
      [inboundReturn.id],
    );
    const inboundTypeField = listFields.inbound.find((field) => field.key === 'billType')!;
    assert.equal(listCellText('inbound', inboundTypeField, inboundList.body.data.items[0]), '退货入库');
    await web.get('/api/v1/web/lists/inbound').query({ billType: 'invalid' }).expect(422);

    const outbound = await createOutboundPlan(
      context.db,
      {
        orderNo: 'B4E-OUT-DEFAULT',
        customerCode: 'DEMO-CUST-1',
        warehouseCode: 'DEMO-WH',
        vehicleNo: 'B4E-TEST',
        containerNo: '柜-02',
        lines: [
          {
            productCode: 'ACR-032',
            plannedPackages: 1,
            plannedWeightGrams: 200000,
            contractNo: 'HT-01',
            memo: '出库行备注',
          },
        ],
      },
      randomUUID(),
      actor,
    );
    assert.equal(outbound.billType, 'sales');
    assert.equal(outbound.containerNo, '柜-02');
    assert.equal(outbound.lines[0]?.contractNo, 'HT-01');
    assert.equal(outbound.lines[0]?.memo, '出库行备注');

    const edited = await editOutboundPlan(
      context.db,
      outbound.id,
      {
        revision: outbound.revision,
        digest: outbound.digest,
        plan: {
          vehicleNo: outbound.vehicleNo,
          billType: 'sample',
          containerNo: '柜-03',
          lines: [{ id: outbound.lines[0]!.id, contractNo: 'HT-02', memo: '已更新备注' }],
        },
      },
      randomUUID(),
      actor,
    );
    assert.equal(edited.billType, 'sample');
    assert.equal(edited.containerNo, '柜-03');
    assert.equal(edited.lines[0]?.contractNo, 'HT-02');
    assert.equal(edited.lines[0]?.memo, '已更新备注');
    assert.equal(edited.lines[0]?.plannedPackages, outbound.lines[0]?.plannedPackages);
    assert.equal(edited.lines[0]?.plannedWeightGrams, outbound.lines[0]?.plannedWeightGrams);
    const confirmed = await confirmOutbound(context.db, {
      planId: edited.id,
      expected: edited,
      key: randomUUID(),
      actor,
      lines: [{ lineId: edited.lines[0]!.id, actualPackages: 1, actualWeightGrams: 200000 }],
    });
    assert.equal(confirmed.actualPackages, 1);
    assert.deepEqual(
      await context.db.get(
        'SELECT packages,weight_grams AS weightGrams FROM outbound_shipment_lines WHERE order_line_id=?',
        [edited.lines[0]!.id],
      ),
      { packages: 1, weightGrams: '200000' },
    );
    const shipmentsBefore = await context.db.all('SELECT * FROM outbound_shipments WHERE order_id=?', [edited.id]);
    const shipmentLinesBefore = await context.db.all('SELECT * FROM outbound_shipment_lines WHERE order_line_id=?', [
      edited.lines[0]!.id,
    ]);
    await assert.rejects(
      editOutboundPlan(
        context.db,
        edited.id,
        {
          revision: confirmed.revision,
          digest: confirmed.digest,
          plan: {
            vehicleNo: edited.vehicleNo,
            containerNo: '禁止改写',
            lines: [{ id: edited.lines[0]!.id, contractNo: '禁止改写', memo: '禁止改写' }],
          },
        },
        randomUUID(),
        actor,
      ),
      { code: 'PLAN_NOT_EDITABLE' },
    );
    assert.deepEqual(
      await context.db.all('SELECT * FROM outbound_shipments WHERE order_id=?', [edited.id]),
      shipmentsBefore,
    );
    assert.deepEqual(
      await context.db.all('SELECT * FROM outbound_shipment_lines WHERE order_line_id=?', [edited.lines[0]!.id]),
      shipmentLinesBefore,
    );

    const outboundList = await web.get('/api/v1/web/lists/outbound').query({ billType: 'sample' }).expect(200);
    assert.deepEqual(
      outboundList.body.data.items.map((row: { id: string }) => row.id),
      [outbound.id],
    );
    const outboundTypeField = listFields.outbound.find((field) => field.key === 'billType')!;
    assert.equal(listCellText('outbound', outboundTypeField, outboundList.body.data.items[0]), '样品出库');
    await web.get('/api/v1/web/lists/outbound').query({ billType: 'invalid' }).expect(422);
  } finally {
    await context.dispose();
  }
});
