import { detailSchema, shipmentPlanSchema } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit } from '../../shared/audit.ts';
import { lockPlan, checkRevision } from '../../shared/command.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { getOrder } from '../outbound/repository.ts';
import { captureVehicle } from '../outbound/snapshots.ts';
import { assertShipmentOrder } from './policy.ts';
import { updatePlanLines } from './plan-lines.ts';
import { AppError } from '../../shared/errors.ts';
import type { ShipmentCommand } from './create.ts';

export async function editShipmentPlan(db: Database, command: ShipmentCommand) {
  const input = shipmentPlanSchema.parse(command.input),
    payload = { id: command.id, input };
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await lockPlan(tx, command.id);
    const previous = await replayCommand(
      tx,
      'outbound.shipment-plan',
      command.key,
      payload,
      command.actor,
      detailSchema,
    );
    if (previous) return previous;
    const before = await getOrder(tx, command.id);
    if (!['open', 'partially_shipped'].includes(before.status))
      throw new AppError('PLAN_CLOSED', '单据已结单，不能修改计划', 422);
    await assertShipmentOrder(tx, before);
    checkRevision(before, input);
    const { plan } = input;
    if (plan.vehicleNo && plan.vehicleNo !== before.vehicleNo)
      await captureVehicle(tx, { id: before.id, plate: plan.vehicleNo }, command.actor);
    if (plan.lines) await updatePlanLines(tx, before, plan.lines);
    await tx.run(
      'UPDATE outbound_orders SET vehicle_no=?,memo=?,bill_type=?,container_no=?,revision=revision+1 WHERE id=?',
      [
        plan.vehicleNo ?? before.vehicleNo,
        plan.memo === undefined ? before.memo : plan.memo,
        plan.billType ?? before.billType,
        plan.containerNo === undefined ? before.containerNo : plan.containerNo,
        before.id,
      ],
    );
    const after = await getOrder(tx, before.id);
    await audit(tx, command.actor, { action: 'outbound.plan.update', targetId: before.id, before, after });
    await saveCommand(tx, 'outbound.shipment-plan', command.key, payload, command.actor, after);
    return after;
  });
}
