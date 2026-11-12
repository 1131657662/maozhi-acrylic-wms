import type { Database } from '../../db/mysql.ts';
import type { ActualQuantity, Detail } from '@wms/contracts';
import type { PlanCommand } from '../../shared/command.ts';
import { confirmShipment } from '../shipments/create.ts';

// Compatibility for existing in-process callers; HTTP aliases share shipmentController.create.
export async function confirmOutbound(
  db: Database,
  command: PlanCommand & { lines: ActualQuantity[] },
): Promise<Detail> {
  return confirmShipment(db, {
    id: command.planId,
    key: command.key,
    actor: command.actor,
    input: { revision: command.expected.revision, digest: command.expected.digest, lines: command.lines },
  });
}
