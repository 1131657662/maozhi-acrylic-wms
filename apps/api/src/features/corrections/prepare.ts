import type { CorrectionInput, CorrectionTarget } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError, ensure } from '../../shared/errors.ts';
import { getInbound } from '../inbound/repository.ts';
import { getOrder } from '../outbound/repository.ts';
import { prepareInventory } from '../inventory/posting.ts';
import { correctionLines } from './attribution.ts';
import { originalShipmentEvidence } from './shipment-evidence.ts';
import { assertOriginalEvidence, assertPriorCorrectionEvidence } from './evidence.ts';

async function document(db: Database, target: CorrectionTarget) {
  const table = target.kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
  const raw = await db.get(`SELECT * FROM ${table} WHERE id=? FOR UPDATE`, [target.id]);
  ensure(raw, 'NOT_FOUND', '原单不存在');
  ensure(raw.source_id === null, 'LEGACY_CORRECTION_FORBIDDEN', '历史导入单禁止更正，只能库存调整');
  ensure(
    raw.source_del_flag === 0 &&
      (target.kind === 'inbound'
        ? raw.status === 'confirmed'
        : ['confirmed', 'partially_shipped', 'short_closed'].includes(String(raw.status))),
    'CORRECTION_DOCUMENT_CLOSED',
    '仅未撤销的已入账原单可以更正',
  );
  const data = target.kind === 'inbound' ? await getInbound(db, target.id) : await getOrder(db, target.id);
  ensure(data.corrections?.allowed, 'CORRECTION_DOCUMENT_CLOSED', '该单不能再开更正');
  ensure(
    data.corrections.revision === Number(raw.correction_revision),
    'CORRECTION_CHAIN_INVALID',
    '原单与更正链版本不一致',
  );
  const operations = await db.all('SELECT id FROM inventory_operations WHERE operation_type=? AND target_id=?', [
    `${target.kind}.confirm`,
    target.id,
  ]);
  const shipment =
    target.kind === 'outbound'
      ? await originalShipmentEvidence(db, { id: target.id, warehouse: data.warehouseCode }, operations)
      : undefined;
  ensure(
    shipment !== null && (shipment || operations.length === 1),
    'ORIGINAL_EVIDENCE_MISSING',
    '原确认操作缺失或重复，不能更正',
  );
  const evidence = { operationId: String(operations[0]!.id), warehouse: data.warehouseCode, summary: data.corrections };
  ensure(
    target.kind !== 'inbound' || raw.confirmation_operation_id === evidence.operationId,
    'ORIGINAL_EVIDENCE_MISSING',
    '原单入账操作引用不一致，不能更正',
  );
  if (!shipment) await assertOriginalEvidence(db, target, evidence);
  await assertPriorCorrectionEvidence(db, target, evidence);
  return {
    warehouse: data.warehouseCode,
    summary: data.corrections,
    state: {
      status: String(raw.status),
      shortClosedPackages: raw.short_closed_packages == null ? null : Number(raw.short_closed_packages),
      shortClosedWeightGrams: raw.short_closed_grams == null ? null : Number(raw.short_closed_grams),
    },
  };
}
export async function prepareCorrection(db: Database, target: CorrectionTarget, input: CorrectionInput) {
  const original = await document(db, target);
  ensure(
    original.summary.revision === input.expectedCorrectionRevision &&
      (original.summary.latest?.id ?? null) === input.previousCorrectionId,
    'STALE_CORRECTION',
    '原单已被更正，请刷新有效数量后重新核对',
  );
  const lines = await correctionLines(db, target, { summary: original.summary, input });
  if (!lines.length) throw new AppError('CORRECTION_NO_CHANGE', '包数和吨数均未变化', 422);
  const sign = target.kind === 'inbound' ? 1 : -1;
  const posted = await prepareInventory(
    db,
    original.warehouse,
    [...new Set(lines.map((line) => line.productCode))].map((code) => ({
      productCode: code,
      packagesDelta: sign * lines.filter((l) => l.productCode === code).reduce((sum, l) => sum + l.delta.packages, 0),
      weightDeltaGrams:
        sign * lines.filter((l) => l.productCode === code).reduce((sum, l) => sum + l.delta.weightGrams, 0),
    })),
  );
  return { ...original, lines, posted };
}
