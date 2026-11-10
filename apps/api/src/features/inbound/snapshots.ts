import type { CreateInbound } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { documentContact } from '../master-data/contacts-read.ts';
export async function captureInboundSnapshots(db: Database, id: string, input: CreateInbound): Promise<void> {
  const contact = await documentContact(db, { partyType: 'supplier', partyCode: input.supplierCode }, input.contactId);
  await db.run(
    `UPDATE inbound_receipts r JOIN master_suppliers s ON s.code=r.supplier_code
    JOIN master_warehouses w ON w.code=r.warehouse_code
    SET r.supplier_name_snapshot=s.name,r.warehouse_name_snapshot=w.name,r.contact_id=?,r.delivery_name=?,
    r.delivery_phone=?,r.delivery_address=?,r.snapshot_origin='created',r.snapshot_captured_at=UTC_TIMESTAMP(3) WHERE r.id=?`,
    [contact?.id ?? null, contact?.name ?? null, contact?.phone ?? null, contact?.address ?? null, id],
  );
  await db.run(
    `UPDATE inbound_lines l JOIN master_products p ON p.code=l.product_code
    SET l.product_name_snapshot=p.name,l.product_model_snapshot=p.model,l.package_type_snapshot=p.package_type WHERE l.receipt_id=?`,
    [id],
  );
}
