import dayjs from 'dayjs';

export function draftKey(identity: string, kind: string, id = 'new') {
  return ['wms-form-draft', identity, kind, id].map(encodeURIComponent).join(':');
}
export function serializeValues(value: unknown): string {
  return JSON.stringify(normalize(value));
}
function normalize(value: unknown): unknown {
  if (dayjs.isDayjs(value)) return { dateValue: value.format('YYYY-MM-DD'), draftType: 'day' };
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key, v]) => !['__proto__', 'constructor', 'prototype'].includes(key) && v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalize(v)]),
    );
  return value === '' ? undefined : value;
}
export function parseValues(text: string): Record<string, unknown> {
  return JSON.parse(text, (key, value: unknown) => {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) return undefined;
    if (value && typeof value === 'object' && 'draftType' in value && value.draftType === 'day' && 'dateValue' in value)
      return dayjs(String(value.dateValue));
    return value;
  }) as Record<string, unknown>;
}
export function readDraft(key: string): { values: string; time: string } | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (
      !data ||
      typeof data !== 'object' ||
      !('values' in data) ||
      typeof data.values !== 'string' ||
      !('time' in data) ||
      typeof data.time !== 'string'
    )
      return null;
    const values: unknown = parseValues(data.values);
    if (!values || typeof values !== 'object' || Array.isArray(values)) return null;
    return { values: data.values, time: data.time };
  } catch {
    return null;
  }
}
