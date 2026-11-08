import { readFileSync, writeFileSync } from 'node:fs';
import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
import { prepareHandoff } from '../../apps/api/tests/handoff-fixture.ts';
import { openDatabase } from '../../apps/api/src/db/mysql.ts';
import { adminConfig } from '../mysql/local-config.ts';
import { createApp } from '../../apps/api/src/app.ts';

const resume = process.argv.includes('--resume');
const saved = resume
  ? (JSON.parse(readFileSync('.local/evidence/b1c2-test-database.json', 'utf8')) as { name: string })
  : null;
if (saved && !/^maozhi_test_[a-f0-9]+$/.test(saved.name)) throw new Error('Disposable DB only');
const temporary = saved ? null : await createTestDatabase();
const name = saved?.name ?? temporary!.name;
const db = temporary?.db ?? openDatabase({ ...adminConfig(), database: name });
const dispose = temporary?.dispose ?? (() => db.close());
if (!resume) {
  await seedDemo(db, 'e2e-only-password');
  const original = JSON.parse(readFileSync('.local/evidence/b1c2-legacy-records.json', 'utf8')) as {
    payload: string;
    state: string;
  }[];
  await prepareHandoff(db, original);
  writeFileSync('.local/evidence/b1c2-test-database.json', JSON.stringify({ name }));
}
console.log(
  'B1C2_EXISTING_FACTS',
  await db.all('SELECT catalog_version,COUNT(*) AS n FROM scan_facts GROUP BY catalog_version'),
);
const server = createApp(db, ['http://127.0.0.1:5175', 'http://127.0.0.1:4313'], true).listen(4313, '127.0.0.1');
server.once('listening', () =>
  console.log(
    `B1C2_DEVICE_API port=4313 isolated_database=${name} mode=${process.argv.includes('--resume') ? 'resume_without_reset' : 'fresh_fixture_60'}`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    server.close(() => void dispose().then(() => process.exit(0)));
  });
