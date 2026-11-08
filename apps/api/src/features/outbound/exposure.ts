import type { Database } from '../../db/mysql.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';

// Persist exposure BEFORE returning a PDA response, including a lost response.
// Acquire the writer lock before any snapshot read so a concurrent void cannot leak an old open plan.
export async function exposePlans<T>(
  db: Database,
  read: (tx: Database) => Promise<{ result: T; ids: string[] }>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const { result, ids } = await read(tx);
    for (const id of ids)
      await tx.run(
        `INSERT INTO outbound_plan_exposures(plan_id,basis,first_exposed_at)
      VALUES(?,'pda-read',UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE plan_id=VALUES(plan_id)`,
        [id],
      );
    return result;
  });
}
