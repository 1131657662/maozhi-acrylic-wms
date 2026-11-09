import { z } from 'zod';

export const businessDateSchema = z.iso.date();
export const businessDateFields = {
  businessDate: businessDateSchema.optional(),
  backdateConfirmed: z.boolean().optional(),
};
export const changeBusinessDateSchema = z.strictObject({
  businessDate: businessDateSchema,
  backdateConfirmed: z.boolean().optional(),
});
export function shanghaiToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function backdateThreshold(today: string): string {
  const day = Number(today.slice(8));
  const month = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  month.setUTCMonth(month.getUTCMonth() - 3);
  const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  month.setUTCDate(Math.min(day, last));
  return month.toISOString().slice(0, 10);
}
