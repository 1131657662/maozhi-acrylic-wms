import type { Correction } from '@wms/contracts';
import type { OriginalLine } from './summary.ts';
import type { ShipmentBasis } from './shipment-basis.ts';
import { ensure } from '../../shared/errors.ts';

type Quantity = { packages: number; weightGrams: number };
export interface EffectiveContext {
  shipments: ShipmentBasis[];
  correctionJournals: Map<string, bigint>;
}
const sum = (values: Quantity[]): Quantity =>
  values.reduce(
    (a, b) => ({
      packages: a.packages + b.packages,
      weightGrams: a.weightGrams + b.weightGrams,
    }),
    { packages: 0, weightGrams: 0 },
  );
function validate(item: Correction['lines'][number], before: Quantity, productCode: string) {
  ensure(
    item.productCode === productCode &&
      item.before.packages === before.packages &&
      item.before.weightGrams === before.weightGrams,
    'CORRECTION_EVIDENCE_INVALID',
    '更正前值与原单/前序更正不一致',
  );
  ensure(
    item.after.packages - item.before.packages === item.delta.packages &&
      item.after.weightGrams - item.before.weightGrams === item.delta.weightGrams &&
      item.after.packages >= 0 &&
      item.after.weightGrams >= 0,
    'CORRECTION_EVIDENCE_INVALID',
    '更正差额证据不一致',
  );
}
function beforeQuantity(
  line: OriginalLine,
  state: Map<string, Quantity>,
  record: Correction,
  context: EffectiveContext,
) {
  const shipmentLines = context.shipments.filter((sh) => sh.lineId === line.id);
  if (!shipmentLines.length) return { packages: line.packages, weightGrams: line.weightGrams };
  const journalId = context.correctionJournals.get(record.id);
  ensure(journalId, 'CORRECTION_EVIDENCE_INVALID', '更正库存流水缺失');
  const recorded = sum(shipmentLines.map((sh) => sh.original));
  return sum([
    { packages: line.packages - recorded.packages, weightGrams: line.weightGrams - recorded.weightGrams },
    ...shipmentLines
      .filter((sh) => sh.journalId > 0n && sh.journalId < journalId)
      .map((sh) => state.get(sh.shipmentLineId)!),
  ]);
}
export function effectiveLine(line: OriginalLine, records: Correction[], context: EffectiveContext) {
  const original = { packages: line.packages, weightGrams: line.weightGrams };
  const state = new Map(context.shipments.map((sh) => [sh.shipmentLineId, { ...sh.original }]));
  let legacy = { packages: 0, weightGrams: 0 };
  const active: Quantity[] = [];
  for (const record of records)
    for (const item of record.lines.filter((r) => r.originalLineId === line.id)) {
      const shipment = item.shipmentLineId
        ? context.shipments.find((sh) => sh.shipmentLineId === item.shipmentLineId)
        : undefined;
      ensure(
        !item.shipmentLineId ||
          (shipment?.lineId === line.id &&
            shipment.productCode === line.productCode &&
            shipment.journalId > 0n &&
            shipment.journalId < (context.correctionJournals.get(record.id) ?? 0n)),
        'CORRECTION_EVIDENCE_INVALID',
        '更正引用的发货行不属于原单明细或尚未发货',
      );
      const before = shipment
        ? state.get(shipment.shipmentLineId)!
        : sum([beforeQuantity(line, state, record, context), legacy]);
      validate(item, before, line.productCode);
      if (shipment) state.set(shipment.shipmentLineId, { ...item.after });
      else legacy = sum([legacy, item.delta]);
      if (!record.offsetOperationId) active.push(item.delta);
    }
  const delta = sum(active),
    current = sum([original, delta]);
  ensure(current.packages >= 0 && current.weightGrams >= 0, 'CORRECTION_EVIDENCE_INVALID', '有效已发数量不能为负');
  return {
    originalLineId: line.id,
    productCode: line.productCode,
    productName: line.productName,
    original,
    effective: current,
    delta,
  };
}
export function effectiveShipment(shipment: ShipmentBasis, records: Correction[]) {
  const delta = sum(
    records
      .filter((r) => !r.offsetOperationId)
      .flatMap((r) => r.lines)
      .filter((l) => l.shipmentLineId === shipment.shipmentLineId)
      .map((l) => l.delta),
  );
  return { original: shipment.original, effective: sum([shipment.original, delta]), delta };
}
