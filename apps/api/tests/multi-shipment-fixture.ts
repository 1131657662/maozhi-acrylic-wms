import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { detailSchema, shipmentListSchema, type Detail } from '@wms/contracts';
import { fixture } from './fixture.ts';

export const version = (order: Detail) => ({ revision: order.revision, digest: order.digest });
export function shipmentBody(order: Detail, packages: number, grams = packages * 300000) {
  return {
    ...version(order),
    lines: order.lines.map((line, index) => ({
      lineId: line.id,
      actualPackages: index === 0 ? packages : 0,
      actualWeightGrams: index === 0 ? grams : 0,
    })),
  };
}
export async function shipmentFixture() {
  const c = await fixture();
  try {
    await c.db.run("UPDATE stock SET packages=200,weight_tonnes='60.0000' WHERE product_code='ACR-032'");
    const web = request.agent(c.app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    const send = (path: string, input: object, key = randomUUID(), method: 'post' | 'patch' = 'post') =>
      web[method](`/api/v1${path}`).set('Origin', 'http://127.0.0.1:5173').set('Idempotency-Key', key).send(input);
    const created = await send('/outbound', {
      customerCode: 'DEMO-CUST-1',
      warehouseCode: 'DEMO-WH',
      vehicleNo: '分批验收',
      lines: [{ productCode: 'ACR-032', plannedPackages: 100, plannedWeightGrams: 30000000 }],
    }).expect(200);
    const order = detailSchema.parse(created.body.data);
    const current = async () =>
      detailSchema.parse((await web.get(`/api/v1/outbound/${order.id}`).expect(200)).body.data);
    const records = async () =>
      shipmentListSchema.parse((await web.get(`/api/v1/outbound/${order.id}/shipments`).expect(200)).body.data);
    const ship = async (packages: number) =>
      detailSchema.parse(
        (await send(`/outbound/${order.id}/shipments`, shipmentBody(await current(), packages)).expect(200)).body.data,
      );
    return { ...c, web, send, order, current, records, ship, path: `/outbound/${order.id}` };
  } catch (error) {
    await c.dispose();
    throw error;
  }
}
export type ShipmentFixture = Awaited<ReturnType<typeof shipmentFixture>>;
