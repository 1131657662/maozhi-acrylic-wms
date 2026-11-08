import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { adminConfig, adminDatabase } from '../mysql/local-config.ts';
import { openDatabase } from '../../apps/api/src/db/mysql.ts';
const { name } = JSON.parse(readFileSync('.local/evidence/b1c2-test-database.json', 'utf8')) as { name: string };
assert.match(name, /^maozhi_test_[a-f0-9]+$/);
const admin = await adminDatabase();
await admin.close();
const db = openDatabase({ ...adminConfig(), database: name });
try {
  const sql = readFileSync('scripts/sql/verify-pda-handoff.sql', 'utf8').replace(/^--.*$/gm, '');
  for (const query of sql
    .split(';')
    .map((q) => q.trim())
    .filter(Boolean)) {
    assert.match(query, /^SELECT /);
    console.log(query);
    console.log(JSON.stringify(await db.all(query)));
  }
} finally {
  await db.close();
}
