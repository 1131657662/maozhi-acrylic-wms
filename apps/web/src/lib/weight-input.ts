export function tonnesToGrams(tonnes: number): number {
  const grams = Math.round(tonnes * 1_000_000);
  if (!Number.isSafeInteger(grams) || grams <= 0 || grams % 100 !== 0)
    throw new Error('总重量需大于零，并精确到 0.0001 吨');
  return grams;
}

export function gramsToTonnes(grams: number): number {
  return Number((grams / 1_000_000).toFixed(4));
}

export function tonnesDeltaToGrams(tonnes: number): number {
  const grams = Math.round(tonnes * 1_000_000);
  if (!Number.isSafeInteger(grams) || grams % 100 !== 0) throw new Error('调整重量需精确到 0.0001 吨');
  return grams;
}
