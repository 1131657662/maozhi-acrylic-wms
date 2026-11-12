import { dateCorrectionSchema, dateCorrectionHistorySchema, type CorrectionTarget } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { AppError, ensure } from '../../shared/errors.ts';

export async function dateCorrectionDocument(db: Database, target: CorrectionTarget, lock = false) {
  const table = target.kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders';
  const row = await db.get(`SELECT * FROM ${table} WHERE id=?${lock ? ' FOR UPDATE' : ''}`, [target.id]);
  if (!row) throw new AppError('NOT_FOUND', '单据不存在', 404);
  return row;
}
export async function dateCorrectionBlock(db: Database, target: CorrectionTarget, row: Record<string, unknown>) {
  if (row.business_date === null) return '该单无原始业务日期（历史单据），不支持日期更正';
  if (row.source_id !== null) return '历史单据不支持日期更正';
  if (row.source_del_flag !== 0 || ['cancelled', 'voided', 'reversed'].includes(String(row.status)))
    return '作废或撤销单据不支持日期更正';
  const posted =
    target.kind === 'inbound'
      ? row.status === 'confirmed' && row.posting_state === 'confirmed'
      : ['partially_shipped', 'confirmed', 'short_closed'].includes(String(row.status));
  if (!posted) return '单据尚未入账，请使用未入账业务日期修改';
  const evidence = await db.get('SELECT id FROM inventory_operations WHERE operation_type=? AND target_id=? LIMIT 1', [
    `${target.kind}.confirm`,
    target.id,
  ]);
  if (!evidence) return '单据缺少入账记录，不支持日期更正';
  return null;
}
export async function readDateCorrections(db: Database, target: CorrectionTarget) {
  const row = await dateCorrectionDocument(db, target);
  const rows = await db.all(
    `SELECT id,document_kind AS documentKind,document_id AS documentId,
    previous_correction_id AS previousCorrectionId,before_date AS beforeDate,after_date AS afterDate,
    reason,actor,operation_id AS operationId,created_at AS createdAt,revision
    FROM document_date_corrections WHERE document_kind=? AND document_id=? ORDER BY revision`,
    [target.kind, target.id],
  );
  const records = rows.map((item) => dateCorrectionSchema.parse({ ...item, createdAt: isoDate(item.createdAt) }));
  let effective = row.business_date;
  for (const [index, record] of records.entries()) {
    ensure(
      record.revision === index + 1 &&
        record.previousCorrectionId === (records[index - 1]?.id ?? null) &&
        record.beforeDate === effective,
      'DATE_CORRECTION_CHAIN_INVALID',
      '业务日期更正链不一致，请核查记录',
    );
    effective = record.afterDate;
  }
  const blockedReason = await dateCorrectionBlock(db, target, row);
  return dateCorrectionHistorySchema.parse({
    businessDate: row.business_date,
    effectiveBusinessDate: effective,
    revision: records.length,
    allowed: blockedReason === null,
    blockedReason,
    records,
  });
}
