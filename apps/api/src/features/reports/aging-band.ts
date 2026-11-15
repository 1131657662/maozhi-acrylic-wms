import type { ReportAgingQuery, ReportAgingRow } from '@wms/contracts';

export function matchesBand(row: ReportAgingRow, band: ReportAgingQuery['band']): boolean {
  if (!band || band === 'all') return true;
  if (band === 'over90')
    return [row.age91To180Grams, row.age181To365Grams, row.ageOver365Grams].some((n) => n !== null && n !== 0);
  return row[band] !== null && row[band] !== 0;
}
