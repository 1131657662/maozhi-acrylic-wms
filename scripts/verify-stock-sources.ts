import { readFileSync } from 'node:fs';
import { adminConfig } from './mysql/local-config.ts';
import { openDatabase } from '../apps/api/src/db/mysql.ts';

// Fixed, isolated local sample database. No migrations, seeds, or writes.
const db = openDatabase({ ...adminConfig(), database: 'maozhi_dev_sample' });
try {
  await db.withConnection(async (connection) => {
    await connection.run('SET SESSION TRANSACTION READ ONLY');
    await connection.run('START TRANSACTION READ ONLY');
    try {
      const sql = readFileSync(new URL('./sql/verify-stock-sources.sql', import.meta.url), 'utf8');
      const statements = sql
        .replace(/^--.*$/gm, '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
      const scoped = await connection.all(statements[0]!);
      const proof = await connection.all(statements[1]!);
      console.log(
        JSON.stringify(
          {
            database: '127.0.0.1:3307/maozhi_dev_sample',
            scoped,
            proof,
            note: '零值或数值巧合可相等；此结果不能单独证明来源，需结合 API 来源契约和 E2E 数据路径。',
          },
          null,
          2,
        ),
      );
      await connection.run('COMMIT');
    } catch (error) {
      await connection.run('ROLLBACK');
      throw error;
    }
  });
} finally {
  await db.close();
}
