import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { MESSAGES, type MessageType } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { sqlDate } from '../../db/dates.ts';
import type { Candidate } from './candidate.ts';

const activeSchema = z.object({ active: z.array(z.object({ eventKey: z.string(), anchor: z.string() })) });
const candidatesTable = `JSON_TABLE(?,'$[*]' COLUMNS(event_key CHAR(64) PATH '$.eventKey',anchor VARCHAR(100) PATH '$.anchor'))`;
async function insertCandidates(db: Database, candidates: Candidate[], now: Date): Promise<number> {
  if (!candidates.length) return 0;
  const payload = candidates.map((c) => ({ ...c, id: randomUUID() }));
  const at = sqlDate(now.toISOString()),
    expires = sqlDate(new Date(now.getTime() + MESSAGES.retentionDays * MESSAGES.dayMs).toISOString());
  const result = await db.run(
    `INSERT INTO notifications(id,type,object_type,object_id,event_key,cycle_anchor,title,body,link_path,created_at,expires_at)
    SELECT j.id,j.type,j.object_type,j.object_id,j.event_key,j.anchor,j.title,j.body,j.link_path,?,?
    FROM JSON_TABLE(?,'$[*]' COLUMNS(id CHAR(36) PATH '$.id',type VARCHAR(24) PATH '$.type',
      object_type VARCHAR(24) PATH '$.objectType',object_id VARCHAR(200) PATH '$.objectId',
      event_key CHAR(64) PATH '$.eventKey',anchor VARCHAR(100) PATH '$.anchor',title VARCHAR(200) PATH '$.title',
      body VARCHAR(500) PATH '$.body',link_path VARCHAR(1000) PATH '$.linkPath')) j
    ON DUPLICATE KEY UPDATE id=notifications.id`,
    [at, expires, JSON.stringify(payload)],
  );
  return result.changes;
}
export async function reconcile(db: Database, input: { type: MessageType; candidates: Candidate[]; now: Date }) {
  const { type, candidates, now } = input;
  const row = await db.get('SELECT detail FROM notification_scan_state WHERE `key`=?', [type]);
  const state = row
    ? activeSchema.parse(typeof row.detail === 'string' ? JSON.parse(row.detail) : row.detail)
    : { active: [] };
  const previous = new Map(state.active.map((c) => [c.eventKey, c.anchor]));
  const active = candidates.map(({ eventKey, anchor }) => ({ eventKey, anchor }));
  const resolved = await db.run(
    `UPDATE notifications n LEFT JOIN ${candidatesTable} c
    ON c.event_key=n.event_key AND c.anchor=n.cycle_anchor SET n.resolved_at=?
    WHERE n.type=? AND n.resolved_at IS NULL AND c.event_key IS NULL`,
    [JSON.stringify(active), sqlDate(now.toISOString()), type],
  );
  const created = await insertCandidates(
    db,
    candidates.filter((c) => previous.get(c.eventKey) !== c.anchor),
    now,
  );
  const detail = { active, matched: candidates.length, created, resolved: resolved.changes };
  await db.run(
    `INSERT INTO notification_scan_state VALUES(?,?,'succeeded',?)
    ON DUPLICATE KEY UPDATE last_run_at=VALUES(last_run_at),last_status='succeeded',detail=VALUES(detail)`,
    [type, sqlDate(now.toISOString()), JSON.stringify(detail)],
  );
  return { matched: candidates.length, created, resolved: resolved.changes };
}
