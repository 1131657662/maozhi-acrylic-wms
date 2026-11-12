import type { Database } from '../../db/mysql.ts';
import type { FactInput, Detail, ScanContextInput } from '@wms/contracts';
import { getOrder } from '../outbound/repository.ts';
import { ensure } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { lockPlan } from '../../shared/command.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { sqlDate } from '../../db/dates.ts';
import { validateFact } from './validate.ts';
import { resolveContext, saveFactContext, contextHash } from './context.ts';

interface ScanCommand {
  planId: string;
  fact: FactInput;
  actor: Actor;
  context?: ScanContextInput;
  metadata?: { source: 'scanner' | 'search' | 'paste' | 'manual'; attribution: 'catalog' | 'manual' };
}
async function insertFact(db: Database, command: ScanCommand, payloadHash: string): Promise<void> {
  const { planId, fact, actor } = command;
  await db.run(
    `INSERT INTO scan_facts(id,plan_id,barcode,weight_tonnes,catalog_version,weight_source,
    device_id,scanned_at,received_at,recorded_by,payload_hash,source,attribution) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      fact.id,
      planId,
      fact.barcode,
      gramsToDecimal(fact.weightGrams),
      fact.catalogVersion,
      fact.weightSource,
      fact.deviceId,
      sqlDate(fact.scannedAt),
      sqlDate(new Date().toISOString()),
      actor.username,
      payloadHash,
      command.metadata?.source ?? 'scanner',
      command.metadata?.attribution ?? null,
    ],
  );
}
export async function recordFact(db: Database, command: ScanCommand): Promise<Detail> {
  return db.transaction(async (tx) => {
    const { planId, fact, actor } = command;
    await lockPlan(tx, planId);
    const payloadHash = hash(JSON.stringify({ planId, fact }));
    const existing = await tx.get('SELECT payload_hash FROM scan_facts WHERE id=?', [fact.id]);
    if (existing) {
      ensure(existing.payload_hash === payloadHash, 'IDEMPOTENCY_CONFLICT', '事实 ID 已使用且正文不同');
      if (command.context)
        ensure(
          (await tx.get('SELECT context_hash FROM scan_fact_context WHERE fact_id=?', [fact.id]))?.context_hash ===
            contextHash(command.context),
          'IDEMPOTENCY_CONFLICT',
          '事实 ID 已绑定不同作业上下文',
        );
      return getOrder(tx, planId);
    }
    const plan = await getOrder(tx, planId);
    const acceptsLate =
      plan.status === 'confirmed' &&
      (await tx.get('SELECT id FROM outbound_shipments WHERE order_id=? LIMIT 1', [planId]));
    ensure(
      (plan.status === 'open' && !plan.scanClosedAt) || acceptsLate,
      'PLAN_CLOSED',
      '单据已结束扫码或终结，原有记录保留',
    );
    const context = await resolveContext(tx, command);
    await validateFact(tx, plan, fact, context.outboundLineId);
    try {
      await insertFact(
        tx,
        { ...command, metadata: command.metadata ?? { source: 'scanner', attribution: context.attribution } },
        payloadHash,
      );
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY')
        ensure(false, 'DUPLICATE_BARCODE', '已录入');
      throw error;
    }
    await saveFactContext(tx, fact, context);
    await tx.run('UPDATE outbound_orders SET revision=revision+1 WHERE id=?', [planId]);
    await audit(tx, actor, {
      action: 'scan.record',
      targetId: planId,
      before: { revision: plan.revision },
      after: {
        ...fact,
        productCode: context.productCode,
        productName: plan.lines.find((l) => l.id === context.outboundLineId)?.productName,
        source: command.metadata?.source ?? 'scanner',
        attribution: command.metadata?.attribution ?? context.attribution,
        orderNo: plan.orderNo,
      },
    });
    return getOrder(tx, planId);
  });
}
