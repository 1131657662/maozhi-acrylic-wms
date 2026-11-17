import path from 'node:path';
import { localMysqlSchema } from '../../db/config.ts';
import type { Database, DatabaseConfig } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { maintenanceErrors as copy } from './copy.ts';

export interface MaintenanceOptions {
  connection: DatabaseConfig;
  directory: string;
}
export function localMaintenanceOptions(connection: DatabaseConfig): MaintenanceOptions {
  const config = localMysqlSchema.parse(connection);
  return { connection: config, directory: path.resolve('.local/backups/maintenance', config.database) };
}
export async function verifyBackupConnection(db: Database, options: MaintenanceOptions): Promise<void> {
  const config = localMysqlSchema.parse(options.connection);
  const current = await db.get(
    "SELECT DATABASE() AS name,(SELECT value FROM app_meta WHERE meta_key='identity') AS identity",
  );
  if (current?.name !== config.database || current.identity !== 'maozhi-local-mysql8-v1')
    throw new AppError('BACKUP_IDENTITY', copy.identity, 409);
}
