import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { maintenanceErrors as copy } from './copy.ts';

export async function withMaintenanceLock<T>(db: Database, work: () => Promise<T>): Promise<T> {
  return db.withConnection(async (connection) => {
    const row = await connection.get('SELECT DATABASE() AS name');
    const lock = `maintenance:${String(row?.name)}`;
    const acquired = await connection.get('SELECT GET_LOCK(?,0) AS acquired', [lock]);
    if (Number(acquired?.acquired) !== 1) throw new AppError('MAINTENANCE_BUSY', copy.busy, 409);
    try {
      return await work();
    } finally {
      await connection.get('SELECT RELEASE_LOCK(?)', [lock]);
    }
  });
}
