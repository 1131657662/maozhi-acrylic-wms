import { contactSchema, type PartyOwner, type Contact } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
export function contactItem(row: Row): Contact {
  return contactSchema.parse({
    id: row.id,
    partyType: row.party_type,
    partyCode: row.owner_code,
    name: row.name,
    phone: row.phone,
    address: row.address,
    active: Number(row.active) === 1,
    isDefault: row.default_id === row.id,
  });
}
export async function readContact(db: Database, id: string): Promise<Contact> {
  const row = await db.get(
    `SELECT c.*,d.contact_id AS default_id FROM party_contacts c LEFT JOIN party_contact_defaults d
    ON d.party_type=c.party_type AND d.party_code=c.owner_code WHERE c.id=?`,
    [id],
  );
  if (!row) throw new AppError('NOT_FOUND', '收送货档案不存在', 404);
  return contactItem(row);
}
export async function suggestedContact(db: Database, owner: PartyOwner): Promise<Contact | null> {
  const row = await db.get(
    `SELECT c.*,d.contact_id AS default_id FROM party_contact_defaults d JOIN party_contacts c ON c.id=d.contact_id
    WHERE d.party_type=? AND d.party_code=? AND c.active=1`,
    [owner.partyType, owner.partyCode],
  );
  if (row) return contactItem(row);
  const table = owner.partyType === 'customer' ? 'outbound_orders' : 'inbound_receipts';
  const used = await db.get(
    `SELECT c.*,NULL AS default_id FROM ${table} o JOIN party_contacts c ON c.id=o.contact_id
    WHERE c.party_type=? AND c.owner_code=? AND c.active=1 AND o.source_del_flag=0 ORDER BY o.created_at DESC,o.id DESC LIMIT 1`,
    [owner.partyType, owner.partyCode],
  );
  return used ? contactItem(used) : null;
}
export async function listContacts(db: Database, owner: PartyOwner) {
  return db.readSnapshot(async (tx) => {
    const rows = await tx.all(
      `SELECT c.*,d.contact_id AS default_id FROM party_contacts c LEFT JOIN party_contact_defaults d
      ON d.party_type=c.party_type AND d.party_code=c.owner_code WHERE c.party_type=? AND c.owner_code=? ORDER BY c.created_at,c.id`,
      [owner.partyType, owner.partyCode],
    );
    return { items: rows.map(contactItem), suggestedId: (await suggestedContact(tx, owner))?.id ?? null };
  });
}
export async function documentContact(db: Database, owner: PartyOwner, id?: string | null): Promise<Contact | null> {
  if (id === null) return null;
  const contact = id ? await readContact(db, id) : await suggestedContact(db, owner);
  if (contact && (!contact.active || contact.partyType !== owner.partyType || contact.partyCode !== owner.partyCode))
    throw new AppError('CONTACT_NOT_AVAILABLE', '联系人不属于当前往来单位或已停用', 422);
  return contact;
}
