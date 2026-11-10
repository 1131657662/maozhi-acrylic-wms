import { mkdirSync, writeFileSync } from 'node:fs';
import { createTestDatabase } from './mysql/test-database.ts';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { seedListEvidence } from './e2e-list-fixtures.ts';
import { DOCUMENTS } from './b6b/fixture.ts';
import { installProbe } from './b6b/probe.ts';
import { diagnoseStock } from './b6b/stock-diagnostic.ts';

const root = '.local/evidence/b6b-step5';
mkdirSync(root, { recursive: true });
const context = await createTestDatabase();
const restoreProbe = installProbe();
try {
  await seedDemo(context.db, 'perf-only-password');
  await seedListEvidence(context.db, DOCUMENTS);
  const result = await diagnoseStock(context.db);
  writeFileSync(`${root}/stock-diagnostic.json`, JSON.stringify(result, null, 2));
} finally {
  restoreProbe();
  await context.dispose();
}
