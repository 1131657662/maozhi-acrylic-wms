const MAX_GRAMS = 99_999_999_999_900n;

/** DECIMAL(12,4) tonnes <-> integer grams. No binary floating-point conversion. */
export function gramsToDecimal(grams: number): string {
  if (!Number.isSafeInteger(grams) || grams % 100 !== 0) throw new Error('重量必须为100克精度的安全整数');
  const value = BigInt(grams);
  const absolute = value < 0n ? -value : value;
  if (absolute > MAX_GRAMS) throw new Error('重量超出 DECIMAL(12,4) 范围');
  const units = absolute / 100n;
  return `${value < 0n ? '-' : ''}${units / 10000n}.${String(units % 10000n).padStart(4, '0')}`;
}

export function decimalToGrams(value: unknown): number {
  if (typeof value !== 'string' || !/^-?\d{1,8}\.\d{4}$/.test(value)) throw new Error('数据库重量必须为四位小数的字符串');
  const negative = value.startsWith('-');
  const units = BigInt(value.replace('-', '').replace('.', ''));
  const grams = units * 100n;
  if (grams > MAX_GRAMS) throw new Error('数据库重量超出范围');
  return Number(negative ? -grams : grams);
}
