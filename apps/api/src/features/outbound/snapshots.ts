import type { OutboundPlanFields } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { documentContact } from '../master-data/contacts-read.ts';
import { resolveDocumentVehicle, recordVehicleUse } from '../master-data/vehicles.ts';
export async function captureOutboundSnapshots(
  db: Database,
  input: { id: string; plan: OutboundPlanFields },
  actor: Actor,
): Promise<void> {
  const { id, plan } = input;
  const contact = await documentContact(db, { partyType: 'customer', partyCode: plan.customerCode }, plan.contactId);
  await db.run(
    `UPDATE outbound_orders o JOIN master_warehouses w ON w.code=o.warehouse_code
    SET o.warehouse_name_snapshot=w.name,o.contact_id=?,o.ship_to_name=?,o.ship_to_phone=?,o.ship_to_address=?,
    o.snapshot_origin='created',o.snapshot_captured_at=UTC_TIMESTAMP(3) WHERE o.id=?`,
    [contact?.id ?? null, contact?.name ?? null, contact?.phone ?? null, contact?.address ?? null, id],
  );
  await db.run(
    `UPDATE outbound_lines l JOIN master_products p ON p.code=l.product_code
    SET l.product_model_snapshot=p.model,l.package_type_snapshot=p.package_type WHERE l.order_id=?`,
    [id],
  );
  await captureVehicle(db, { id, plate: plan.vehicleNo }, actor);
}
export async function captureVehicle(db: Database, input: { id: string; plate: string }, actor: Actor): Promise<void> {
  const vehicle = await resolveDocumentVehicle(db, input.plate, actor);
  await db.run('UPDATE outbound_orders SET vehicle_id=? WHERE id=?', [vehicle.id, input.id]);
  await recordVehicleUse(db, vehicle.id, input.id);
}
