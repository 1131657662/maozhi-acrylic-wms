export function sqlDate(iso: string): string {
  return new Date(iso).toISOString().replace('T', ' ').replace('Z', '');
}
export function isoDate(value: unknown): string {
  if (typeof value !== 'string') throw new Error('数据库日期格式不正确');
  return new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z').toISOString();
}
