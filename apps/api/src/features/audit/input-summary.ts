import { redactAuditValue } from './sanitize.ts';

const codes = ['warehouseCode', 'productCode', 'customerCode', 'supplierCode', 'receiptNo', 'orderNo', 'businessDate'];
const quantities = [
  'packages',
  'weightGrams',
  'packagesDelta',
  'weightDeltaGrams',
  'plannedPackages',
  'plannedWeightGrams',
];
const MAX_CODE = 80;
export function auditObject(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !Buffer.isBuffer(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}
export function auditCode(value: unknown): string | null {
  return typeof value === 'string' && value.length <= MAX_CODE && /^[\p{L}\p{N}_.:/-]+$/u.test(value) ? value : null;
}
export function inputSummary(action: string, input: unknown): Record<string, unknown> {
  const source = auditObject(input);
  if (action === 'auth.login') return { claimedUsername: auditCode(source.username) };
  const result: Record<string, unknown> = {};
  // Explicit scalar allowlist. Never retain remarks, reason, arbitrary nested values, uploads or headers.
  for (const key of codes) if (auditCode(source[key]) !== null) result[key] = source[key];
  for (const key of quantities)
    if (typeof source[key] === 'number' && Number.isSafeInteger(source[key])) result[key] = source[key];
  for (const key of ['lines', 'items', 'records', 'factIds'])
    if (Array.isArray(source[key])) result[`${key}Count`] = source[key].length;
  return auditObject(redactAuditValue(result));
}
