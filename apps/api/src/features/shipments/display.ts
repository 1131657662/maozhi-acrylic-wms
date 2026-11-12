import { OUTBOUND_ACTUAL_PRECISION_GRAMS as PRECISION, type Detail } from '@wms/contracts';
import { remainingLines } from './policy.ts';

export function shipmentDisplay(order: Detail) {
  const terminal = ['short_closed', 'cancelled', 'voided'].includes(order.status);
  const pending = remainingLines(order);
  const lines = order.lines.map((line, index) => {
    const effective = order.corrections?.lines.find((item) => item.originalLineId === line.id)?.effective;
    return {
      lineId: line.id,
      productCode: line.productCode,
      productName: line.productName,
      contractNo: line.contractNo,
      memo: line.memo,
      plannedPackages: line.plannedPackages,
      plannedWeightGrams: line.plannedWeightGrams,
      effectivePackages: effective?.packages ?? line.actualPackages,
      effectiveWeightGrams: effective?.weightGrams ?? line.actualWeightGrams,
      remainingPackages: terminal ? 0 : pending[index]!.packages,
      remainingWeightGrams: terminal ? 0 : pending[index]!.weightGrams,
      prefillPackages: null as number | null,
      prefillWeightGrams: null as number | null,
    };
  });
  for (const code of new Set(lines.map((line) => line.productCode))) {
    fillProduct(
      lines.filter((line) => line.productCode === code),
      order.facts.filter((fact) => fact.productCode === code),
    );
  }
  return {
    revision: order.revision,
    digest: order.digest,
    status: order.status,
    vehicleNo: order.vehicleNo,
    plannedPackages: order.plannedPackages,
    plannedWeightGrams: order.plannedWeightGrams,
    effectivePackages: order.corrections?.effective.packages ?? order.actualPackages,
    effectiveWeightGrams: order.corrections?.effective.weightGrams ?? order.actualWeightGrams,
    lines,
  };
}

interface PrefillLine {
  effectivePackages: number;
  remainingPackages: number;
  prefillPackages: number | null;
  prefillWeightGrams: number | null;
}
function fillProduct(lines: PrefillLine[], facts: Detail['facts']) {
  if (!facts.length) return;
  let remaining = Math.max(0, facts.length - lines.reduce((sum, line) => sum + line.effectivePackages, 0));
  const packages = remaining;
  const scannedGrams = facts.reduce((sum, fact) => sum + fact.weightGrams, 0);
  let grams = proportionalGrams(scannedGrams, packages, facts.length);
  const totalGrams = grams;
  lines.forEach((line, index) => {
    const count = index === lines.length - 1 ? remaining : Math.min(remaining, line.remainingPackages);
    remaining -= count;
    const weight = remaining === 0 ? grams : Math.min(grams, proportionalGrams(totalGrams, count, packages));
    grams -= weight;
    line.prefillPackages = count;
    line.prefillWeightGrams = weight;
  });
}
function proportionalGrams(grams: number, count: number, total: number): number {
  if (!total) return 0;
  return (
    Number((BigInt(grams / PRECISION) * BigInt(count) + BigInt(Math.floor(total / 2))) / BigInt(total)) * PRECISION
  );
}
