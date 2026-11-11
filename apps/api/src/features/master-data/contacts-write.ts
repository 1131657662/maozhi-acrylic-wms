import { randomUUID } from 'node:crypto';
import { contactSchema, createContactSchema, updateContactSchema, type PartyOwner } from '@wms/contracts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { activeMaster } from './catalogs.ts';
import { readContact } from './contacts-read.ts';

async function lockOwner(db: Database, owner: PartyOwner): Promise<void> {
  const table = owner.partyType === 'customer' ? 'master_customers' : 'master_suppliers';
  await db.get(`SELECT code FROM ${table} WHERE code=? FOR UPDATE`, [owner.partyCode]);
  await activeMaster(db, owner.partyType === 'customer' ? 'customers' : 'suppliers', owner.partyCode);
}
export async function createContact(db: Database, input: unknown, actor: Actor, key?: string) {
  const data = createContactSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const replay = key ? await replayCommand(tx, 'contact.create', key, data, actor, contactSchema) : undefined;
    if (replay) return replay;
    await lockOwner(tx, data);
    const id = randomUUID();
    await tx.run(
      `INSERT INTO party_contacts(id,party_type,customer_code,supplier_code,name,phone,address,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
      [
        id,
        data.partyType,
        data.partyType === 'customer' ? data.partyCode : null,
        data.partyType === 'supplier' ? data.partyCode : null,
        data.name,
        data.phone ?? null,
        data.address ?? null,
      ],
    );
    const after = await readContact(tx, id);
    await audit(tx, actor, { action: 'contact.create', targetId: id, before: null, after });
    if (key) await saveCommand(tx, 'contact.create', key, data, actor, after);
    return after;
  });
}
export async function updateContact(db: Database, id: string, input: unknown, actor: Actor) {
  const data = updateContactSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const before = await readContact(tx, id);
    await lockOwner(tx, before);
    if (data.active === false) await tx.run('DELETE FROM party_contact_defaults WHERE contact_id=?', [id]);
    const after = { ...before, ...data };
    await tx.run('UPDATE party_contacts SET name=?,phone=?,address=?,active=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [
      after.name,
      after.phone ?? null,
      after.address ?? null,
      Number(after.active),
      id,
    ]);
    const saved = await readContact(tx, id);
    await audit(tx, actor, { action: 'contact.update', targetId: id, before, after: saved });
    return saved;
  });
}
export async function setDefaultContact(db: Database, id: string, actor: Actor) {
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const contact = await readContact(tx, id);
    await lockOwner(tx, contact);
    if (!contact.active) throw new AppError('CONTACT_INACTIVE', '停用的档案不能设为默认', 422);
    const before = await tx.get('SELECT contact_id FROM party_contact_defaults WHERE party_type=? AND party_code=?', [
      contact.partyType,
      contact.partyCode,
    ]);
    await tx.run(
      `INSERT INTO party_contact_defaults(party_type,party_code,contact_id) VALUES(?,?,?)
      ON DUPLICATE KEY UPDATE contact_id=VALUES(contact_id)`,
      [contact.partyType, contact.partyCode, id],
    );
    const after = await readContact(tx, id);
    await audit(tx, actor, { action: 'contact.default', targetId: id, before: before ?? null, after });
    return after;
  });
}
export async function deleteContact(db: Database, id: string, actor: Actor): Promise<void> {
  await db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const before = await readContact(tx, id);
    await lockOwner(tx, before);
    if (
      before.isDefault ||
      (await tx.get('SELECT id FROM inbound_receipts WHERE contact_id=? LIMIT 1', [id])) ||
      (await tx.get('SELECT id FROM outbound_orders WHERE contact_id=? LIMIT 1', [id]))
    )
      throw new AppError('CONTACT_IN_USE', '默认或已被单据引用的档案只能停用', 422);
    await tx.run('DELETE FROM party_contacts WHERE id=?', [id]);
    await audit(tx, actor, { action: 'contact.delete', targetId: id, before, after: null });
  });
}
