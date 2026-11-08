import { AppError } from '../../shared/errors.ts';
export function addExact(...values: number[]): number {
  let sum = 0n;
  for (const value of values) {
    if (!Number.isSafeInteger(value))
      throw new AppError('REPORT_PRECISION', '报表数值超出精确计算范围，请缩小区间；未返回失真结果', 422);
    sum += BigInt(value);
  }
  const result = Number(sum);
  if (!Number.isSafeInteger(result))
    throw new AppError('REPORT_PRECISION', '报表累计超出安全整数范围，请缩小区间；未截断数值', 422);
  return result;
}
