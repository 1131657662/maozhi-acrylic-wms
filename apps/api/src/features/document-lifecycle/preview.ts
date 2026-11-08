import { lifecyclePreviewSchema, type LifecycleBlocker, type LifecyclePreview } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { hash } from '../../shared/hash.ts';
import { documentTables, readDocument, type DocumentTarget, type LifecycleDocument } from './document.ts';
import { reversalProof } from './proof.ts';

async function voidBlockers(db: Database, doc: LifecycleDocument): Promise<LifecycleBlocker[]> {
  const journalRef = doc.kind === 'inbound' ? 'inbound_receipt_id' : 'order_id';
  const operation = await db.get(
    'SELECT id FROM inventory_operations WHERE target_id=? AND operation_type LIKE ? LIMIT 1',
    [doc.id, `${doc.kind}.%`],
  );
  const journal = await db.get(`SELECT id FROM stock_journal WHERE ${journalRef}=? LIMIT 1`, [doc.id]);
  const blockers: LifecycleBlocker[] = [];
  if (operation || journal || doc.confirmationId)
    blockers.push({ code: 'ALREADY_POSTED', message: '本单存在入账证据，不能作废。已入账单据只能申请撤销确认。' });
  if (doc.kind !== 'outbound') return blockers;
  const exposure = await db.get('SELECT basis FROM outbound_plan_exposures WHERE plan_id=?', [doc.id]);
  const submission = await db.get('SELECT plan_id FROM scan_submissions WHERE plan_id=?', [doc.id]);
  const handoff = await db.get('SELECT fact_id FROM pda_handoff_records WHERE plan_id=? LIMIT 1', [doc.id]);
  if (doc.facts || submission)
    blockers.push({
      code: 'SCAN_DEPENDENCY',
      message: '本单已有扫码事实或冻结记录；作废及晚到事实处理留待 B2b，不能删除现场记录。',
    });
  if (handoff)
    blockers.push({
      code: 'HANDOFF_DEPENDENCY',
      message: '本单已有设备交接清单记录；尚未补传的事实不能因作废而丢弃，本批禁止作废。',
    });
  if (exposure)
    blockers.push({
      code: 'PDA_EXPOSURE',
      message:
        exposure.basis === 'pda-read'
          ? '本单已下发 PDA，可能仍有离线待补传记录；本批禁止作废。'
          : '迁移前的出库计划下发状态不明，不能证明现场队列为空；本批禁止作废。',
    });
  return blockers;
}
async function closure(db: Database, target: DocumentTarget) {
  const row = await db.get(
    `SELECT id,action,reason,actor,created_at AS createdAt,
    original_operation_id AS originalOperationId,compensation_operation_id AS compensationOperationId
    FROM document_closures WHERE ${documentTables[target.kind].reference}=?`,
    [target.id],
  );
  return row ? { ...row, createdAt: isoDate(row.createdAt) } : null;
}
// Called inside a read snapshot for preview, or after writer + document locks for a command.
export async function lifecyclePreview(db: Database, target: DocumentTarget): Promise<LifecyclePreview> {
  const doc = await readDocument(db, target),
    closed = await closure(db, target);
  const action = doc.confirmed ? 'reverse' : doc.pending ? 'void' : null;
  let proof: Pick<LifecyclePreview, 'originalOperationId' | 'lines' | 'blockers'> = {
    originalOperationId: null,
    lines: [],
    blockers: [],
  };
  if (doc.legacy)
    proof.blockers.push({
      code: 'LEGACY_READ_ONLY',
      message: '历史单据仅供查阅；缺少可靠原确认操作，不在本批撤销或作废。',
    });
  else if (closed || !action)
    proof.blockers.push({
      code: 'DOCUMENT_CLOSED',
      message: '单据已终结或不处于可处理状态；原单号不复用，不重新开放扫码。',
    });
  else if (action === 'reverse') proof = await reversalProof(db, doc);
  else proof.blockers = await voidBlockers(db, doc);
  const result = {
    kind: target.kind,
    id: target.id,
    number: doc.number,
    status: doc.status,
    action,
    ...proof,
    closure: closed,
    allowed: proof.blockers.length === 0 && action !== null,
  };
  return lifecyclePreviewSchema.parse({ ...result, token: hash(JSON.stringify({ doc: doc.fingerprint, result })) });
}
