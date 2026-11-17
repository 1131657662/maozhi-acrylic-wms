import { messageCopy } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { unreadCount, unreadWhere } from './read.ts';

export async function markRead(db: Database, actor: Actor, id?: string) {
  return db.transaction(async (tx) => {
    if (id && !(await tx.get('SELECT id FROM notifications WHERE id=? FOR UPDATE', [id])))
      throw new AppError('MESSAGE_NOT_FOUND', messageCopy.notFound, 404);
    const result = await tx.run(
      `UPDATE notifications SET read_at=UTC_TIMESTAMP(3)
      WHERE ${id ? 'id=? AND read_at IS NULL' : unreadWhere}`,
      id ? [id] : [],
    );
    if (result.changes)
      await audit(tx, actor, {
        action: id ? 'message.read' : 'message.read_all',
        targetId: id ?? 'messages',
        before: null,
        after: { name: messageCopy.title, count: result.changes },
      });
    return unreadCount(tx);
  });
}
