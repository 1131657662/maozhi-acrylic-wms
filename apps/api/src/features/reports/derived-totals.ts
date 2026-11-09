import type { ReportAgingRow, ReportAgingTotals, ReportTurnoverRow, ReportTurnoverTotals } from '@wms/contracts';

function sumKnown(rows: { [key: string]: unknown }[], key: string): number | null {
  if (!rows.length || rows.some((row) => row[key] === null)) return null;
  const sum = rows.reduce((total, row) => total + Number(row[key]), 0);
  return Number.isSafeInteger(sum) ? sum : null;
}

export function turnoverTotals(rows: ReportTurnoverRow[]): ReportTurnoverTotals {
  return {
    netOutboundGrams: sumKnown(rows, 'netOutboundGrams'),
    dailyClosingGramsSum: sumKnown(rows, 'dailyClosingGramsSum'),
  };
}

export function agingTotals(rows: ReportAgingRow[]): ReportAgingTotals {
  return {
    closingPackages: sumKnown(rows, 'closingPackages'),
    age0To30Grams: sumKnown(rows, 'age0To30Grams'),
    age31To90Grams: sumKnown(rows, 'age31To90Grams'),
    age91To180Grams: sumKnown(rows, 'age91To180Grams'),
    age181To365Grams: sumKnown(rows, 'age181To365Grams'),
    ageOver365Grams: sumKnown(rows, 'ageOver365Grams'),
    unagedGrams: sumKnown(rows, 'unagedGrams'),
    closingGrams: sumKnown(rows, 'closingGrams'),
  };
}
