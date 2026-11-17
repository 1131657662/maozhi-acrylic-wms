import { randomBytes } from 'node:crypto';
import { RESTORE } from '@wms/contracts';
import type { Database, DatabaseConfig } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { maintenanceAdmin } from './local-admin.ts';
import { sqlIdentifier } from './baseline-tables.ts';
import { restoreText as t } from './restore-copy.ts';

export interface RestoreOwnership {
  jobId: string;
  source: string;
  database: string;
  account: string;
}
export function newRestoreOwnership(jobId: string, source: string): RestoreOwnership {
  return {
    jobId,
    source,
    database: `maozhi_restore_${randomBytes(RESTORE.randomBytes).toString('hex')}`,
    account: `mr_${randomBytes(RESTORE.randomBytes).toString('hex')}`,
  };
}
export function assertRestoreOwnership(owner: RestoreOwnership): void {
  if (
    !/^maozhi_restore_[a-f0-9]{24}$/.test(owner.database) ||
    owner.database === owner.source ||
    !/^mr_[a-f0-9]{24}$/.test(owner.account)
  )
    throw new AppError('RESTORE_OWNERSHIP', t.ownership, 409);
}
export async function createRestoreDatabase(owner: RestoreOwnership): Promise<void> {
  assertRestoreOwnership(owner);
  const admin = await maintenanceAdmin();
  try {
    await admin.run(`CREATE DATABASE ${sqlIdentifier(owner.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin`);
  } finally {
    await admin.close();
  }
}
export async function createRestoreAccount(
  owner: RestoreOwnership,
  onCreated?: () => Promise<void>,
): Promise<DatabaseConfig> {
  assertRestoreOwnership(owner);
  const admin = await maintenanceAdmin(),
    password = randomBytes(RESTORE.passwordBytes).toString('hex');
  try {
    await admin.run("CREATE USER ?@'127.0.0.1' IDENTIFIED BY ? ATTRIBUTE ?", [
      owner.account,
      password,
      JSON.stringify(owner),
    ]);
    await onCreated?.();
    const grantDatabase = '`' + owner.database.replaceAll('_', '\\_') + '`';
    await admin.run(
      `GRANT SELECT,INSERT,UPDATE,DELETE,CREATE,ALTER,DROP,INDEX,REFERENCES,CREATE VIEW,SHOW VIEW,TRIGGER,LOCK TABLES ON ${grantDatabase}.* TO ?@'127.0.0.1'`,
      [owner.account],
    );
    return { host: '127.0.0.1', port: 3307, user: owner.account, password, database: owner.database };
  } finally {
    await admin.close();
  }
}
export async function lockRestoreAccount(owner: RestoreOwnership): Promise<{ account: boolean; database: boolean }> {
  assertRestoreOwnership(owner);
  const admin = await maintenanceAdmin();
  try {
    const database = Boolean(
      await admin.get('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?', [owner.database]),
    );
    return { account: await closeAccount(admin, owner), database };
  } finally {
    await admin.close();
  }
}
async function closeAccount(admin: Database, owner: RestoreOwnership): Promise<boolean> {
  const account = await admin.get(
    "SELECT User_attributes AS attributes FROM mysql.user WHERE User=? AND Host='127.0.0.1'",
    [owner.account],
  );
  if (!account) return false;
  const attributes = typeof account.attributes === 'string' ? JSON.parse(account.attributes) : account.attributes;
  const actual = attributes?.metadata;
  if (!actual || Object.entries(owner).some(([key, value]) => actual[key] !== value))
    throw new AppError('RESTORE_OWNERSHIP', t.ownership, 409);
  await admin.run("ALTER USER ?@'127.0.0.1' ACCOUNT LOCK", [owner.account]);
  const connections = await admin.all('SELECT ID FROM information_schema.PROCESSLIST WHERE USER=?', [owner.account]);
  for (const row of connections) {
    const id = Number(row.ID);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error('无效的连接编号');
    await admin.run(`KILL CONNECTION ${id}`).catch((error: unknown) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'ER_NO_SUCH_THREAD')) throw error;
    });
  }
  return true;
}
