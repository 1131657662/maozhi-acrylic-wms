import { createTestDatabase } from './mysql/test-database.ts';
import { seedDemo } from '../apps/api/src/db/seed-test.ts';
import { createApp, localOrigins } from '../apps/api/src/app.ts';
import { seedNumberingEvidence } from './e2e-numbering-fixtures.ts';
import { seedSourceEvidence } from './e2e-source-fixtures.ts';

const { db, dispose } = await createTestDatabase();
await seedDemo(db, 'e2e-only-password');
await seedNumberingEvidence(db);
await seedSourceEvidence(db);
const server = createApp(db, [...localOrigins, 'http://localhost:5174', 'http://127.0.0.1:5174']).listen(
  Number(process.env.TEST_PORT ?? 4311),
  '127.0.0.1',
);

let closing = false;
async function shutdown(): Promise<void> {
  if (closing) return;
  closing = true;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await dispose();
}
process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
