import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fixture, actor } from './fixture.ts';
import { createContact } from '../src/features/master-data/contacts-write.ts';
import { createVehicle } from '../src/features/master-data/vehicles.ts';

test('联系人和车辆创建并发重放只建一条，同键改内容拒绝且不追加审计', async () => {
  const { db, dispose } = await fixture();
  try {
    const contactKey = randomUUID(),
      vehicleKey = randomUUID();
    const contact = { partyType: 'customer', partyCode: 'DEMO-CUST-1', name: '重复保护联系人' };
    const contacts = await Promise.all(Array.from({ length: 10 }, () => createContact(db, contact, actor, contactKey)));
    assert.equal(new Set(contacts.map((c) => c.id)).size, 1);
    const vehicles = await Promise.all(
      Array.from({ length: 10 }, () => createVehicle(db, { plate: '苏A12345' }, actor, vehicleKey)),
    );
    assert.equal(new Set(vehicles.map((v) => v.id)).size, 1);
    await assert.rejects(createContact(db, { ...contact, name: '改变内容' }, actor, contactKey), {
      code: 'IDEMPOTENCY_CONFLICT',
    });
    await assert.rejects(createVehicle(db, { plate: '苏A12346' }, actor, vehicleKey), { code: 'IDEMPOTENCY_CONFLICT' });
    for (const id of [contacts[0]!.id, vehicles[0]!.id])
      assert.equal((await db.all('SELECT id FROM operation_log WHERE target_id=?', [id])).length, 1);
    assert.equal(Number((await db.get('SELECT COUNT(*) AS n FROM party_contacts WHERE name=?', [contact.name]))?.n), 1);
    assert.equal(
      Number((await db.get("SELECT COUNT(*) AS n FROM master_vehicles WHERE plate_normalized='苏A12346'"))?.n),
      0,
    );
  } finally {
    await dispose();
  }
});
