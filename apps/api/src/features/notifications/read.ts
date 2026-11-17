import { MESSAGES, messageSchema, type MessageQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';

export const unreadWhere = 'read_at IS NULL AND resolved_at IS NULL';
export async function unreadCount(db: Database): Promise<{ unreadCount: number }> {
  const row = await db.get(`SELECT COUNT(*) AS total FROM notifications WHERE ${unreadWhere}`);
  return { unreadCount: Number(row?.total ?? 0) };
}
function project(row: Row) {
  return messageSchema.parse({
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    linkPath: row.link_path,
    createdAt: isoDate(row.created_at),
    readAt: row.read_at ? isoDate(row.read_at) : null,
    resolvedAt: row.resolved_at ? isoDate(row.resolved_at) : null,
  });
}
export async function listMessages(db: Database, query: MessageQuery) {
  return db.readSnapshot(async (tx) => {
    const where = ['1=1'],
      values: string[] = [];
    if (query.type) {
      where.push('type=?');
      values.push(query.type);
    }
    if (query.unread !== undefined)
      where.push(query.unread ? `(${unreadWhere})` : '(read_at IS NOT NULL OR resolved_at IS NOT NULL)');
    const predicate = where.join(' AND ');
    const total = await tx.get(`SELECT COUNT(*) AS total FROM notifications WHERE ${predicate}`, values);
    const rows = await tx.all(
      `SELECT id,type,title,body,link_path,created_at,read_at,resolved_at FROM notifications
      WHERE ${predicate} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
      [...values, MESSAGES.pageSize, (query.page - 1) * MESSAGES.pageSize],
    );
    return {
      items: rows.map(project),
      total: Number(total?.total ?? 0),
      ...(await unreadCount(tx)),
      page: query.page,
      pageSize: MESSAGES.pageSize,
    };
  });
}
