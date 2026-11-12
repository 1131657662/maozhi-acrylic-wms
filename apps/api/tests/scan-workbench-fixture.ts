import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { fixture } from './fixture.ts';
import { addV1Fixture } from './catalog-fixture.ts';

export async function countingFixture(through?: string) {
  const c = await fixture(through);
  try {
    await c.db.run(`INSERT INTO master_products(code,name,active,created_at,updated_at,origin_kind,inventory_eligible)
      VALUES('SECOND','第二商品',1,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3),'legacy',1)`);
    await c.db
      .run(`INSERT INTO outbound_lines(id,order_id,product_code,product_name,planned_packages,planned_weight_tonnes,line_position)
      VALUES('SECOND-LINE','DEMO-001','SECOND','第二商品',3,'0.9000',1)`);
    await addV1Fixture(c.db, { barcode: 'UNMAPPED-001', product: 'SPEC-UNKNOWN', tonnes: '0.3000' });
    await addV1Fixture(c.db, { barcode: 'SECOND-001', product: 'SECOND', tonnes: '0.3000' });
    const web = request.agent(c.app);
    await web
      .post('/api/v1/auth/login')
      .send({ username: 'owner', password: 'test-only-password', channel: 'web' })
      .expect(200);
    const post = (input: object, key = randomUUID(), suffix = '') =>
      web
        .post(`/api/v1/outbound/DEMO-001/scan-records${suffix}`)
        .set('Origin', 'http://127.0.0.1:5173')
        .set('Idempotency-Key', key)
        .send(input);
    return { ...c, web, post };
  } catch (error) {
    await c.dispose();
    throw error;
  }
}
