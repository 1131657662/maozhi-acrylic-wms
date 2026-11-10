import { mkdirSync, writeFileSync } from 'node:fs';
import { developmentConfig } from '../apps/api/src/db/config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';
import { productEligibilityReport } from '../apps/api/src/db/product-eligibility.ts';
import { adminDatabase } from './mysql/local-config.ts';
const admin = await adminDatabase();
await admin.close();
const config = developmentConfig();
if (config.database !== 'maozhi_dev_sample') throw new Error('资格报告仅允许开发样本库');
const db = openDatabase(config);
try {
  const report = await db.readSnapshot(productEligibilityReport);
  mkdirSync('.local/evidence/b6a', { recursive: true });
  writeFileSync('.local/evidence/b6a/product-eligibility.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify(
      {
        total: report.total,
        eligible: report.eligible,
        notEligible: report.notEligible,
        pendingApp: report.decisions.filter((row) => row.sourceKind === 'app' && !row.eligible),
        report: '.local/evidence/b6a/product-eligibility.json',
      },
      null,
      2,
    ),
  );
} finally {
  await db.close();
}
