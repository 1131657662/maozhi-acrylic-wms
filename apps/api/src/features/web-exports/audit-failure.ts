import type { ExportJob } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import type { Actor } from '../../shared/audit.ts';
import { auditContext, newAttempt } from '../audit/context.ts';
import { recordFailedAttempt } from '../audit/attempts.ts';

export async function recordExportFailure(db: Database, actor: Actor, job: ExportJob, error: unknown): Promise<void> {
  const parent = auditContext.getStore();
  const context = newAttempt(
    {
      action: `export.${job.state}`,
      targetKind: 'export',
      targetId: job.id,
      channel: parent?.channel ?? actor.channel ?? null,
    },
    parent?.traceId ?? actor.traceId,
  );
  context.actor = actor.username;
  // Export has no inventory transaction. The failed/cancelled artifact is unavailable before this call.
  await recordFailedAttempt(db, context, error);
}
