import { correctionSummarySchema, type Correction, type CorrectionTarget } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { readCorrections } from './read.ts';

export interface OriginalLine {
  id: string;
  productCode: string;
  productName: string;
  packages: number;
  weightGrams: number;
}
interface SummaryInput extends CorrectionTarget {
  lines: OriginalLine[];
  eligible: boolean;
}
function effective(line: OriginalLine, records: Correction[]) {
  const original = { packages: line.packages, weightGrams: line.weightGrams },
    current = { ...original };
  for (const record of records)
    for (const item of record.lines.filter((r) => r.originalLineId === line.id)) {
      ensure(
        item.productCode === line.productCode &&
          item.before.packages === current.packages &&
          item.before.weightGrams === current.weightGrams,
        'CORRECTION_EVIDENCE_INVALID',
        '更正前值与原单/前序更正不一致',
      );
      ensure(
        item.after.packages - item.before.packages === item.delta.packages &&
          item.after.weightGrams - item.before.weightGrams === item.delta.weightGrams,
        'CORRECTION_EVIDENCE_INVALID',
        '更正差额证据不一致',
      );
      current.packages += item.delta.packages;
      current.weightGrams += item.delta.weightGrams;
    }
  return {
    originalLineId: line.id,
    productCode: line.productCode,
    productName: line.productName,
    original,
    effective: current,
    delta: {
      packages: current.packages - original.packages,
      weightGrams: current.weightGrams - original.weightGrams,
    },
  };
}
export async function correctionSummary(db: Database, input: SummaryInput) {
  const records = await readCorrections(db, input);
  ensure(
    records.every((r) => r.lines.every((l) => input.lines.some((o) => o.id === l.originalLineId))),
    'CORRECTION_EVIDENCE_INVALID',
    '更正引用的原行不存在',
  );
  const lines = input.lines.map((l) => effective(l, records));
  const latest = records.at(-1);
  const total = (key: 'original' | 'effective' | 'delta') =>
    lines.reduce(
      (sum, l) => ({
        packages: sum.packages + l[key].packages,
        weightGrams: sum.weightGrams + l[key].weightGrams,
      }),
      { packages: 0, weightGrams: 0 },
    );
  return correctionSummarySchema.parse({
    revision: latest?.revision ?? 0,
    allowed: input.eligible && records.every((r) => r.offsetOperationId === null),
    offset: records.some((r) => r.offsetOperationId !== null),
    original: total('original'),
    effective: total('effective'),
    delta: total('delta'),
    latest: latest ? { id: latest.id, number: latest.number, createdAt: latest.createdAt } : null,
    lines,
    records,
  });
}
