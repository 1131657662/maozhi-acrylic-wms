import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { restoreText } from './restore-copy.ts';

export async function restorePreflight(db: Database): Promise<void> {
  const row = await db.get('SELECT @@log_bin AS binlog,@@log_bin_trust_function_creators AS trusted');
  if (Number(row?.binlog) === 1 && Number(row?.trusted) !== 1)
    throw new AppError('RESTORE_TRIGGER_PREREQUISITE', restoreText.prerequisite, 409);
}
