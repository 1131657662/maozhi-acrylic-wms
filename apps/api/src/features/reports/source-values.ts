import { decimalToGrams } from '../../db/weight.ts';

export function objectJson(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {};
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
}
export function nullableInt(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[+-]?\d+$/.test(value.trim()))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : null;
}
export function optionalGrams(value: unknown): number | null {
  if (value == null || value === '') return null;
  try {
    return decimalToGrams(value);
  } catch {
    return null;
  }
}
export function localIso(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,6})?$/.test(value)) return null;
  const date = new Date(value.replace(' ', 'T').slice(0, 23) + '+08:00');
  if (Number.isNaN(date.getTime())) return null;
  const wall = new Date(date.getTime() + 8 * 3600000).toISOString();
  return wall.slice(0, 19) === value.replace(' ', 'T').slice(0, 19) ? date.toISOString() : null;
}
