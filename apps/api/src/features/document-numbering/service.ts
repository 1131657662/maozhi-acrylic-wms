import { numberingRuleSchema, numberingUpdateSchema, type DocumentKind, type NumberingRule } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError, ensure } from '../../shared/errors.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import {
  businessDate,
  ensureRule,
  lastSequence,
  lockNumbering,
  numberExists,
  prefixes,
  readRule,
} from './repository.ts';

async function candidate(db: Database, kind: DocumentKind, width: number, date: string) {
  const next = (await lastSequence(db, kind, date)) + 1n;
  ensure(next < 10n ** BigInt(width), 'NUMBER_SEQUENCE_EXHAUSTED', '序号超出所选宽度，请增大序号宽度；计数器不会重置');
  const number = `${prefixes[kind]}-${date}-${String(next).padStart(width, '0')}`;
  ensure(
    !(await numberExists(db, number)),
    'NUMBERING_COLLISION',
    `下一单号 ${number} 已存在（含历史/软删）；请增大宽度后重试，原配置未改变`,
  );
  return { number, next };
}
export async function rulePreview(db: Database, kind: DocumentKind, date = businessDate()): Promise<NumberingRule> {
  const rule = await readRule(db, kind);
  const result = { kind, prefix: prefixes[kind], ...rule, dateKey: date, timeZone: 'Asia/Shanghai' as const };
  try {
    return { ...result, preview: (await candidate(db, kind, rule.width, date)).number, previewError: null };
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    return { ...result, preview: null, previewError: error.message };
  }
}
export async function listNumbering(db: Database): Promise<NumberingRule[]> {
  return db.transaction(async (tx) => {
    await lockNumbering(tx);
    const date = businessDate();
    return [await rulePreview(tx, 'inbound', date), await rulePreview(tx, 'outbound', date)];
  });
}
// Called only inside the document transaction, after its global identity lock and replay check.
export async function allocateNumber(db: Database, kind: DocumentKind, legacy?: string): Promise<string> {
  if (legacy !== undefined) {
    ensure(
      !(await numberExists(db, legacy)),
      kind === 'inbound' ? 'RECEIPT_NO_EXISTS' : 'DUPLICATE_ORDER_NO',
      '旧客户端指定单号已存在；未替换为自动号',
    );
    return legacy;
  }
  await ensureRule(db, kind);
  const rule = await readRule(db, kind);
  const date = businessDate();
  const { number, next } = await candidate(db, kind, rule.width, date);
  await db.run(
    `INSERT INTO document_number_counters(kind,date_key,last_sequence) VALUES(?,?,?)
    ON DUPLICATE KEY UPDATE last_sequence=VALUES(last_sequence)`,
    [kind, date, String(next)],
  );
  return number;
}
export async function updateNumbering(db: Database, kind: DocumentKind, input: unknown, key: string, actor: Actor) {
  const change = numberingUpdateSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockNumbering(tx);
    const payload = { kind, ...change };
    const replay = await replayCommand(tx, 'numbering.update', key, payload, actor, numberingRuleSchema);
    if (replay) return replay;
    const before = await rulePreview(tx, kind);
    ensure(
      before.version === change.expectedVersion,
      'NUMBERING_VERSION_CONFLICT',
      '编号配置已变化，请刷新预览后重新保存',
    );
    await candidate(tx, kind, change.width, businessDate());
    await ensureRule(tx, kind);
    await tx.run('UPDATE document_number_rules SET sequence_width=?,version=version+1 WHERE kind=?', [
      change.width,
      kind,
    ]);
    const after = await rulePreview(tx, kind);
    await audit(tx, actor, { action: 'numbering.update', targetId: kind, before, after });
    await saveCommand(tx, 'numbering.update', key, payload, actor, after);
    return after;
  });
}
