import type { z } from 'zod';
import { detailSchema, type Detail } from '@wms/contracts';
import { factDigest } from './fact-projection.ts';
import type { headerSchema, rawLineSchema, rawFactSchema } from './rows.ts';
import { allocateScans } from './scan-allocation.ts';

type Header = z.infer<typeof headerSchema>;
type Line = z.infer<typeof rawLineSchema>;
type Fact = z.infer<typeof rawFactSchema>;
interface Data {
  lines: Line[];
  facts: Fact[];
  products: Map<string, string>;
}
export function assembleOrders(headers: Header[], data: Data): Detail[] {
  return headers.map((header) => assembleOrder(header, data));
}
function assembleOrder(header: Header, data: Data): Detail {
  const sourceLines = data.lines.filter((line) => line.orderId === header.id);
  const facts = data.facts
    .filter((fact) => fact.planId === header.id)
    .map((fact) => {
      const line = sourceLines.find((line) => line.id === data.products.get(fact.id));
      return { ...fact, productCode: line?.productCode, productName: line?.productName };
    });
  const scans = allocateScans(
    sourceLines,
    facts.map((fact) => ({ productCode: fact.productCode ?? '', weightGrams: fact.weightGrams })),
  );
  const lines = sourceLines.map((line) => projectLine(line, scans.get(line.id)!, header, facts, data.products));
  return detailSchema.parse({
    ...header,
    lines,
    facts,
    plannedPackages: lines.reduce((sum, line) => sum + line.plannedPackages, 0),
    plannedWeightGrams: lines.reduce((sum, line) => sum + line.plannedWeightGrams, 0),
    scanPackages: lines.reduce((sum, line) => sum + (line.scanPackages ?? 0), 0),
    scanWeightGrams: lines.reduce((sum, line) => sum + (line.scanWeightGrams ?? 0), 0),
    actualPackages: lines.reduce((sum, line) => sum + line.actualPackages, 0),
    actualWeightGrams: lines.reduce((sum, line) => sum + line.actualWeightGrams, 0),
    digest: factDigest(facts),
  });
}
function projectLine(
  line: Line,
  scan: { scanPackages: number; scanWeightGrams: number },
  header: Header,
  facts: Fact[],
  bindings: Map<string, string>,
) {
  const legacy = ['confirmed', 'cancelled'].includes(header.status) && line.actualPackages === null;
  const old = legacy ? facts.filter((fact) => bindings.get(fact.id) === line.id) : [];
  return {
    ...line,
    scanPackages: line.scanPackages ?? (scan.scanPackages || null),
    scanWeightGrams: line.scanWeightGrams ?? (scan.scanPackages ? scan.scanWeightGrams : null),
    actualPackages: line.actualPackages ?? old.length,
    actualWeightGrams: line.actualWeightGrams ?? old.reduce((sum, fact) => sum + fact.weightGrams, 0),
  };
}
