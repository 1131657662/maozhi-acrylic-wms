import type { CorrectionInput, CorrectionSummary, CorrectionTarget } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { AppError } from '../../shared/errors.ts';
import { shipmentBasis, type ShipmentBasis } from './shipment-basis.ts';
import { effectiveShipment } from './effective.ts';

function resolve(basis: ShipmentBasis[], requested: CorrectionInput['lines'][number]) {
  const candidates = basis.filter((sh) => sh.lineId === requested.originalLineId);
  if (new Set(basis.map((sh) => sh.shipmentId)).size >= 2 && !requested.shipmentLineId)
    throw new AppError('SHIPMENT_LINE_REQUIRED', '本单分多次发货，请选择要更正的发货明细', 422, {
      lines: candidates.map((sh) => ({
        shipmentLineId: sh.shipmentLineId,
        originalLineId: sh.lineId,
        seq: sh.seq,
        productCode: sh.productCode,
        ...sh.original,
      })),
    });
  const selected = requested.shipmentLineId
    ? candidates.find((sh) => sh.shipmentLineId === requested.shipmentLineId)
    : candidates.length === 1
      ? candidates[0]
      : undefined;
  if ((requested.shipmentLineId || basis.length) && !selected)
    throw new AppError('SHIPMENT_LINE_INVALID', '所选发货明细不属于本单的对应商品行', 422);
  return selected;
}
export async function correctionLines(
  db: Database,
  target: CorrectionTarget,
  context: { summary: CorrectionSummary; input: CorrectionInput },
) {
  const basis = target.kind === 'outbound' ? await shipmentBasis(db, target.id) : [];
  return context.input.lines
    .map((requested) => {
      const original = context.summary.lines.find((line) => line.originalLineId === requested.originalLineId);
      if (!original) throw new AppError('CORRECTION_LINE_INVALID', '只能更正原单已有明细', 422);
      if (target.kind === 'inbound' && requested.shipmentLineId)
        throw new AppError('SHIPMENT_LINE_INVALID', '入库明细不能引用发货明细', 422);
      const shipment = resolve(basis, requested);
      const before = shipment ? effectiveShipment(shipment, context.summary.records).effective : original.effective;
      const after = { packages: requested.packages, weightGrams: requested.weightGrams };
      if (
        original.effective.packages + after.packages - before.packages < 0 ||
        original.effective.weightGrams + after.weightGrams - before.weightGrams < 0
      )
        throw new AppError('CORRECTION_QUANTITY_INVALID', '更正后该订单行的有效数量不能为负，请核对历史更正', 422);
      return {
        originalLineId: original.originalLineId,
        shipmentLineId: shipment?.shipmentLineId ?? null,
        productCode: original.productCode,
        before,
        after,
        delta: { packages: after.packages - before.packages, weightGrams: after.weightGrams - before.weightGrams },
      };
    })
    .filter((line) => line.delta.packages !== 0 || line.delta.weightGrams !== 0);
}
