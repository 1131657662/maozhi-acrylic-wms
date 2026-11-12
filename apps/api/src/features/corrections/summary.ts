import { correctionSummarySchema, type CorrectionTarget } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { ensure } from '../../shared/errors.ts';
import { readCorrections } from './read.ts';
import { shipmentBasis } from './shipment-basis.ts';
import { effectiveLine, effectiveShipment } from './effective.ts';

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
export async function correctionSummary(db: Database, input: SummaryInput) {
  const records = await readCorrections(db, input);
  ensure(
    records.every((r) => r.lines.every((l) => input.lines.some((o) => o.id === l.originalLineId))),
    'CORRECTION_EVIDENCE_INVALID',
    '更正引用的原行不存在',
  );
  const shipments = input.kind === 'outbound' ? await shipmentBasis(db, input.id) : [];
  const journals = records.length
    ? await db.all(
        `SELECT correction_id,MIN(id) AS id FROM stock_journal
    WHERE correction_id IN (${records.map(() => '?').join(',')}) GROUP BY correction_id`,
        records.map((r) => r.id),
      )
    : [];
  const context = {
    shipments,
    correctionJournals: new Map(journals.map((r) => [String(r.correction_id), BigInt(String(r.id))])),
  };
  const lines = input.lines.map((l) => ({
    ...effectiveLine(l, records, context),
    ...(shipments.length
      ? {
          shipments: shipments
            .filter((sh) => sh.lineId === l.id)
            .map((sh) => ({
              shipmentLineId: sh.shipmentLineId,
              seq: sh.seq,
              vehicleNo: sh.vehicleNo,
              shippedAt: sh.shippedAt,
              original: sh.original,
              effective: effectiveShipment(sh, records).effective,
            })),
        }
      : {}),
  }));
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
