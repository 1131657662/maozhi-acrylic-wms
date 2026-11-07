import { readFileSync } from 'node:fs';
import { z } from 'zod';

export const localMysqlSchema = z.object({
  host: z.literal('127.0.0.1'), port: z.literal(3307),
  user: z.string().min(1), password: z.string().min(16),
  database: z.string().regex(/^maozhi_(dev|dev_sample|test_[a-f0-9]+|restore_[a-f0-9]+)$/),
});
export function developmentConfig() {
  if (process.env.NODE_ENV === 'production') throw new Error('生产连接尚未开放');
  const path = new URL('../../../../.local/mysql/dev.json', import.meta.url);
  return localMysqlSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
}
