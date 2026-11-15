import os from 'node:os';
import { writeFile } from 'node:fs/promises';
import { createTestDatabase } from '../mysql/test-database.ts';
import { seedDemo } from '../../apps/api/src/db/seed-test.ts';
import { seedListEvidence } from '../e2e-list-fixtures.ts';
import { verifyCapacity } from './capacity.ts';

const c = await createTestDatabase();
try {
  await writeFile(
    '.local/evidence/b6i-1/environment.json',
    JSON.stringify(
      {
        node: process.version,
        os: os.release(),
        cpu: os.cpus()[0]?.model,
        logicalCpus: os.cpus().length,
        memory: os.totalmem(),
        database: await c.db.get('SELECT VERSION() AS version,@@port AS port'),
        settings: await c.db.all(
          "SHOW VARIABLES WHERE Variable_name IN ('innodb_buffer_pool_size','slow_query_log','long_query_time','performance_schema')",
        ),
        concurrency: 1,
        cold: false,
        databaseBufferPoolFlushed: false,
      },
      null,
      2,
    ),
  );
  await seedDemo(c.db, 'perf-only-password');
  await seedListEvidence(c.db, 100000);
  await verifyCapacity(c.db);
} finally {
  await c.dispose();
}
