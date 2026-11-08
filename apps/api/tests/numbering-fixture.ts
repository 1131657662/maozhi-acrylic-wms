import request from 'supertest';
import { once } from 'node:events';
import { fixture } from './fixture.ts';

export const origin = 'http://127.0.0.1:5173';
export const newReceipt = () => ({
  supplierCode: 'DEMO-SUPPLIER',
  warehouseCode: 'DEMO-WH',
  lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 302500 }],
});
export const newPlan = () => ({
  customerCode: 'DEMO-CUST-1',
  warehouseCode: 'DEMO-WH',
  vehicleNo: 'NUMBER-TEST',
  lines: [{ productCode: 'ACR-032', plannedPackages: 1, plannedWeightGrams: 302500 }],
});

export async function numberingFixture() {
  const context = await fixture();
  const server = context.app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const web = request.agent(server);
  await web
    .post('/api/v1/auth/login')
    .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
    .expect(200);
  const dispose = async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await context.dispose();
  };
  return { ...context, web, dispose };
}
