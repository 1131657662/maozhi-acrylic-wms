import { AUDIT_OBJECT_PAGE_SIZE, AUDIT_EVENT_PAGE_SIZE } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { auditPredicate, auditSafeFields, auditUnion, type AuditQuery } from './query.ts';
import { eventPage, nextCursor } from './records.ts';
import { projectAuditRows } from './projection.ts';
export async function objectEvents(db: Database, kind: string, id: string, cursor?: string) {
  return db.readSnapshot(async (tx) => {
    const page = await eventPage(
      tx,
      { sql: `FROM ${auditUnion} WHERE target_kind=? AND target_id=?`, values: [kind, id] },
      cursor,
    );
    return { items: await projectAuditRows(tx, page.rows), total: page.total, nextCursor: page.nextCursor };
  });
}
export async function auditTimeline(db: Database, query: AuditQuery) {
  return db.readSnapshot(async (tx) => {
    const predicate = auditPredicate(query);
    const base = `${predicate.sql} AND target_kind IS NOT NULL AND target_id IS NOT NULL`;
    const grouped = `SELECT target_kind,target_id,MAX(created_at) AS latest ${base} GROUP BY target_kind,target_id`;
    const total = Number((await tx.get(`SELECT COUNT(*) AS n FROM (${grouped}) objects`, predicate.values))?.n);
    const objects = await tx.all(`${grouped} ORDER BY latest DESC,target_kind,target_id LIMIT ? OFFSET ?`, [
      ...predicate.values,
      AUDIT_OBJECT_PAGE_SIZE,
      (query.page - 1) * AUDIT_OBJECT_PAGE_SIZE,
    ]);
    const items = await timelineGroups(tx, objects);
    return { items, total, page: query.page, pageSize: AUDIT_OBJECT_PAGE_SIZE };
  });
}
async function timelineGroups(db: Database, objects: Row[]) {
  if (!objects.length) return [];
  const conditions = objects.map(() => '(target_kind=? AND target_id=?)').join(' OR ');
  const rows = await db.all(
    `SELECT * FROM (SELECT ${auditSafeFields},
    ROW_NUMBER() OVER(PARTITION BY target_kind,target_id ORDER BY created_at DESC,record_id DESC) AS position,
    COUNT(*) OVER(PARTITION BY target_kind,target_id) AS event_count
    FROM ${auditUnion} WHERE ${conditions}) ranked WHERE position<=? ORDER BY created_at DESC,record_id DESC`,
    [...objects.flatMap((row) => [String(row.target_kind), String(row.target_id)]), AUDIT_EVENT_PAGE_SIZE + 1],
  );
  const projected = await projectAuditRows(db, rows);
  return objects.map((object) => {
    const matched = rows.filter((row) => row.target_kind === object.target_kind && row.target_id === object.target_id);
    const items = matched.slice(0, AUDIT_EVENT_PAGE_SIZE).map((row) => projected[rows.indexOf(row)]!);
    const first = items[0]!;
    return {
      id: first.id,
      objectLabel: first.objectLabel,
      objectType: first.objectType,
      href: first.href,
      events: {
        items,
        total: Number(matched[0]?.event_count ?? 0),
        nextCursor: nextCursor(matched, AUDIT_EVENT_PAGE_SIZE),
      },
    };
  });
}
