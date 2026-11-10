import {
  DOCUMENT_NUMBER_CAPACITY,
  DOCUMENT_NUMBER_WIDTH,
  NUMBER_CAPACITY_MESSAGE,
  type DocumentKind,
  type NumberingRule,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError, ensure } from '../../shared/errors.ts';
import type { Actor } from '../../shared/audit.ts';
import {
  businessDate,
  ensureRule,
  lastSequence,
  lockNumbering,
  numberExists,
  prefixes,
  readRule,
} from './repository.ts';

async function candidate(db: Database, kind: DocumentKind, date: string) {
  const next = (await lastSequence(db, kind, date)) + 1n;
  if (next > BigInt(DOCUMENT_NUMBER_CAPACITY))
    throw new AppError('NUMBER_SEQUENCE_EXHAUSTED', NUMBER_CAPACITY_MESSAGE, 422);
  const number = `${prefixes[kind]}-${date}-${String(next).padStart(DOCUMENT_NUMBER_WIDTH, '0')}`;
  ensure(
    !(await numberExists(db, number)),
    'NUMBERING_COLLISION',
    `下一单号 ${number} 已存在（含历史/软删），请核对编号计数；未创建单据`,
  );
  return { number, next };
}
export async function rulePreview(db: Database, kind: DocumentKind, date = businessDate()): Promise<NumberingRule> {
  const rule = await readRule(db, kind);
  const result = { kind, prefix: prefixes[kind], ...rule, dateKey: date, timeZone: 'Asia/Shanghai' as const };
  try {
    return { ...result, preview: (await candidate(db, kind, date)).number, previewError: null };
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
export async function allocateNumber(
  db: Database,
  kind: DocumentKind,
  legacy?: string,
  date = businessDate(),
): Promise<string> {
  if (legacy !== undefined) {
    ensure(
      !(await numberExists(db, legacy)),
      kind === 'inbound' ? 'RECEIPT_NO_EXISTS' : 'DUPLICATE_ORDER_NO',
      '旧客户端指定单号已存在；未替换为自动号',
    );
    return legacy;
  }
  await ensureRule(db, kind);
  const { number, next } = await candidate(db, kind, date);
  await db.run(
    `INSERT INTO document_number_counters(kind,date_key,last_sequence) VALUES(?,?,?)
    ON DUPLICATE KEY UPDATE last_sequence=VALUES(last_sequence)`,
    [kind, date, String(next)],
  );
  return number;
}
export async function updateNumbering(
  _db: Database,
  _kind: DocumentKind,
  _input: unknown,
  _key: string,
  _actor: Actor,
) {
  throw new AppError('NUMBERING_READ_ONLY', '编号规则固定为 3 位，只读；单日最多 999 单', 422);
}
