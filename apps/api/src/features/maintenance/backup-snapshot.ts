import { RESTORE, type BackupBaseline } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { MaintenanceOptions } from './options.ts';
import { maintenanceAdmin } from './local-admin.ts';
import { databaseTables, sqlIdentifier } from './baseline-tables.ts';
import { captureBaseline } from './baseline.ts';
import { mysqlDump } from './dump.ts';

export async function dumpWithBaseline(
  db: Database,
  input: { options: MaintenanceOptions; filename: string },
): Promise<BackupBaseline> {
  const admin = await maintenanceAdmin();
  const database = sqlIdentifier(input.options.connection.database!);
  try {
    return await admin.withConnection(async (lock) => {
      await lock.run(`SET SESSION lock_wait_timeout=${RESTORE.lockWaitSeconds}`);
      const names = await databaseTables(db);
      if (!names.length) throw new Error('拒绝备份空结构');
      await lock.run(`LOCK TABLES ${names.map((name) => `${database}.${sqlIdentifier(name)} READ`).join(',')}`);
      try {
        await mysqlDump(input.options.connection, input.filename);
        const baseline = await captureBaseline(db);
        if (JSON.stringify(names) !== JSON.stringify(baseline.tables.map((table) => table.name)))
          throw new Error('备份时表集合发生变化');
        return baseline;
      } finally {
        await lock.run('UNLOCK TABLES');
      }
    });
  } finally {
    await admin.close();
  }
}
