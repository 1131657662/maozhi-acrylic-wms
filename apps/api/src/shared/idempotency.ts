import { z } from 'zod';
import type { Database } from '../db/mysql.ts';
import type { Actor } from './audit.ts';
import { ensure } from './errors.ts';
import { hash } from './hash.ts';

export async function replayCommand<T>(db: Database, scope: string, key: string, input: unknown,
  actor: Actor, schema: z.ZodType<T>): Promise<T | undefined> {
  const commandKey = `${scope}:${actor.username}:${key}`;
  const previous = await db.get('SELECT payload_hash,result_json FROM idempotent_commands WHERE command_key=?', [commandKey]);
  if (!previous) return undefined;
  ensure(previous.payload_hash === hash(JSON.stringify(input)), 'IDEMPOTENCY_CONFLICT', '幂等键已用于不同请求');
  return schema.parse(JSON.parse(String(previous.result_json)));
}
export async function saveCommand(db: Database, scope: string, key: string, input: unknown,
  actor: Actor, result: unknown): Promise<void> {
  await db.run('INSERT INTO idempotent_commands(command_key,payload_hash,result_json) VALUES(?,?,?)',
    [`${scope}:${actor.username}:${key}`, hash(JSON.stringify(input)), JSON.stringify(result)]);
}
