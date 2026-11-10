import type { MasterCatalog, MasterItem } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
export async function partyProjection(
  db: Database,
  catalog: MasterCatalog,
  items: MasterItem[],
): Promise<MasterItem[]> {
  if (!['customers', 'suppliers'].includes(catalog) || !items.length) return items;
  const rows = await db.all(
    `SELECT d.party_code,c.name,c.phone,c.address FROM party_contact_defaults d
    JOIN party_contacts c ON c.id=d.contact_id AND c.active=1 WHERE d.party_type=? AND d.party_code IN (${items.map(() => '?').join(',')})`,
    [catalog === 'customers' ? 'customer' : 'supplier', ...items.map((item) => item.code)],
  );
  const defaults = new Map(rows.map((row) => [String(row.party_code), row]));
  return items.map((item) => {
    const contact = defaults.get(item.code);
    return {
      ...item,
      contact: contact ? String(contact.name) : null,
      phone: contact?.phone == null ? null : String(contact.phone),
      address: contact?.address == null ? null : String(contact.address),
    };
  });
}
