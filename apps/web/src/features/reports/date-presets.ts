export const REPORT_MONTHLY_MONTHS = 12;
export const REPORT_TURNOVER_MONTHS = 6;
const DAY_MS = 86400000;
function dates() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  return {
    today,
    yesterday: new Date(Date.parse(today + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10),
    monthStart: today.slice(0, 7) + '-01',
  };
}
function monthsStart(today: string, count: number) {
  const month = new Date(today.slice(0, 7) + '-01T00:00:00Z');
  month.setUTCMonth(month.getUTCMonth() - count + 1);
  return month.toISOString().slice(0, 10);
}
export function reportDefaults(kind?: 'monthly') {
  const { today, monthStart } = dates();
  return {
    basis: 'posted',
    fromDay: kind === 'monthly' ? monthsStart(today, REPORT_MONTHLY_MONTHS) : monthStart,
    toDay: today,
  };
}
export function derivedReportDefaults(): { scope: string; basis: string; fromDay: string; toDay: string };
export function derivedReportDefaults(aging: true): {
  scope: string;
  basis: string;
  fromDay: string;
  toDay: string;
  cutoffDay: string;
};
export function derivedReportDefaults(aging = false) {
  const { today, yesterday, monthStart } = dates();
  return {
    scope: 'inventory',
    basis: 'posted',
    fromDay: aging ? monthStart : monthsStart(today, REPORT_TURNOVER_MONTHS),
    toDay: aging && yesterday < monthStart ? today : yesterday,
    ...(aging ? { cutoffDay: today } : {}),
  };
}
export function dateRangeFor(preset: string, custom: unknown): [string, string] | null {
  const { today, yesterday, monthStart } = dates();
  if (preset === 'recent12') return [monthsStart(today, REPORT_MONTHLY_MONTHS), today];
  if (preset === 'recent6') return [monthsStart(today, REPORT_TURNOVER_MONTHS), yesterday];
  if (preset === 'current') return [monthStart, yesterday < monthStart ? today : yesterday];
  if (preset === 'previous') {
    const lastDay = new Date(Date.parse(monthStart + 'T00:00:00Z') - DAY_MS).toISOString().slice(0, 10);
    return [lastDay.slice(0, 7) + '-01', lastDay];
  }
  if (preset === '30days')
    return [new Date(Date.parse(yesterday + 'T00:00:00Z') - 29 * DAY_MS).toISOString().slice(0, 10), yesterday];
  return Array.isArray(custom) && custom.length === 2 ? [String(custom[0]), String(custom[1])] : null;
}
