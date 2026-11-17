import { randomUUID } from 'node:crypto';
import type { Database } from '../src/db/mysql.ts';
import { hash } from '../src/shared/hash.ts';
import type { MessageType } from '@wms/contracts';

interface Input {
  id?: string;
  type?: MessageType;
  createdAt?: string;
  readAt?: string;
  resolvedAt?: string;
}
export async function notificationFixture(db: Database, input: Input = {}): Promise<string> {
  const id = input.id ?? randomUUID();
  await db.run(
    `INSERT INTO notifications(id,type,object_type,object_id,event_key,cycle_anchor,title,body,link_path,
    created_at,read_at,resolved_at,expires_at) VALUES(?,?,'outbound','DEMO-001',?,'cycle','待确认出库单','请核对人工实发',
    '/outbound/DEMO-001',?,?,?,DATE_ADD(?,INTERVAL 90 DAY))`,
    [
      id,
      input.type ?? 'pending',
      hash(id),
      input.createdAt ?? '2026-11-17 00:00:00',
      input.readAt ?? null,
      input.resolvedAt ?? null,
      input.createdAt ?? '2026-11-17 00:00:00',
    ],
  );
  return id;
}
