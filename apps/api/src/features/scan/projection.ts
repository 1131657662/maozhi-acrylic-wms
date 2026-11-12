import type { Detail } from '@wms/contracts';
import { allocateScans } from '../outbound/scan-allocation.ts';
// Existing PDA clients use actual* for scanner progress. Web uses the shipment projection.
export function pdaScanProjection(order: Detail): Detail {
  const scans = allocateScans(
    order.lines,
    order.facts.map((fact) => ({ productCode: fact.productCode ?? '', weightGrams: fact.weightGrams })),
  );
  return {
    ...order,
    actualPackages: order.facts.length,
    actualWeightGrams: order.facts.reduce((sum, fact) => sum + fact.weightGrams, 0),
    facts: order.facts.map(
      ({ productCode: _code, productName: _name, source: _source, attribution: _attribution, ...fact }) => fact,
    ),
    lines: order.lines.map((line) => ({
      ...line,
      actualPackages: scans.get(line.id)?.scanPackages ?? 0,
      actualWeightGrams: scans.get(line.id)?.scanWeightGrams ?? 0,
    })),
  };
}
