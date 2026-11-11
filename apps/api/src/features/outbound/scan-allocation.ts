import { OUTBOUND_ACTUAL_PRECISION_GRAMS } from '@wms/contracts';

interface Line {
  id: string;
  productCode: string;
  plannedPackages: number;
}
interface Scan {
  productCode: string;
  weightGrams: number;
}
export function allocateScans(lines: Line[], scans: Scan[]) {
  const totals = new Map<string, { packages: number; grams: number }>();
  for (const scan of scans) {
    const total = totals.get(scan.productCode) ?? { packages: 0, grams: 0 };
    total.packages += 1;
    total.grams += scan.weightGrams;
    totals.set(scan.productCode, total);
  }
  const result = new Map<string, { scanPackages: number; scanWeightGrams: number }>();
  for (const code of new Set(lines.map((line) => line.productCode))) {
    const group = lines.filter((line) => line.productCode === code);
    const total = totals.get(code) ?? { packages: 0, grams: 0 };
    allocateGroup(group, total).forEach((value, index) => result.set(group[index]!.id, value));
  }
  return result;
}
function allocateGroup(lines: Line[], total: { packages: number; grams: number }) {
  let remaining = total.packages;
  const counts = lines.map((line, index) => {
    const packages = index === lines.length - 1 ? remaining : Math.min(remaining, line.plannedPackages);
    remaining -= packages;
    return packages;
  });
  const lastFilled = counts.findLastIndex((packages) => packages > 0);
  let remainingGrams = total.grams;
  return counts.map((packages, index) => {
    if (packages === 0) return { scanPackages: 0, scanWeightGrams: 0 };
    const units = total.packages
      ? (BigInt(total.grams / OUTBOUND_ACTUAL_PRECISION_GRAMS) * BigInt(packages) +
          BigInt(Math.floor(total.packages / 2))) /
        BigInt(total.packages)
      : 0n;
    const grams =
      index === lastFilled ? remainingGrams : Math.min(remainingGrams, Number(units) * OUTBOUND_ACTUAL_PRECISION_GRAMS);
    remainingGrams -= grams;
    return { scanPackages: packages, scanWeightGrams: grams };
  });
}
