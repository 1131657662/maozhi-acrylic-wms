import { backupBaselineSchema, type RestoreReport } from '@wms/contracts';
import type { Database, DatabaseConfig } from '../../db/mysql.ts';
import { openDatabase } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { captureBaseline } from './baseline.ts';
import { buildRestoreReport } from './restore-report.ts';
import { jsonValue, saveRestoreReport } from './restore-records.ts';
import { restoreText as t } from './restore-copy.ts';

export async function verifyRestore(
  db: Database,
  input: { id: string; config: DatabaseConfig; baseline: unknown },
): Promise<RestoreReport> {
  const restored = openDatabase(input.config);
  try {
    if (
      (await restored.get("SELECT value FROM app_meta WHERE meta_key='identity'"))?.value !== 'maozhi-local-mysql8-v1'
    )
      throw new AppError('RESTORE_IDENTITY', t.identity, 409);
    const expected = input.baseline == null ? null : backupBaselineSchema.parse(jsonValue(input.baseline));
    const actual = await captureBaseline(restored);
    await db.run('UPDATE restore_verifications SET actual_baseline=? WHERE job_id=?', [
      JSON.stringify(actual),
      input.id,
    ]);
    const report = buildRestoreReport(expected, actual);
    await saveRestoreReport(db, input.id, report);
    await restored.run('DELETE FROM sessions');
    const sessions = Number((await restored.get('SELECT COUNT(*) AS n FROM sessions'))?.n);
    report.items.push({
      label: '恢复副本会话清空（单列例外）',
      expected: '0',
      actual: String(sessions),
      difference: sessions === 0 ? '仅清空副本会话，原库会话保留' : '副本会话未清空',
      conclusion: sessions === 0 ? 'passed' : 'mismatch',
    });
    if (sessions !== 0) report.outcome = 'mismatch';
    await saveRestoreReport(db, input.id, report);
    return report;
  } finally {
    await restored.close();
  }
}
