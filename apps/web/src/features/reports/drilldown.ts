import type { ListParams } from '../web-lists/keys';

const carried = [
  'fromDay',
  'toDay',
  'warehouse',
  'product',
  'warehouseCodes',
  'productCode',
  'movement',
  'movements',
  'types',
  'basis',
] as const;
export const reportContextKeys = ['drilldown'] as const;
export function reportDrilldown(path: string, params: ListParams, patch: ListParams = {}): string {
  const target: ListParams = {
    basis: 'posted',
    movement: 'all',
    ...Object.fromEntries(carried.filter((key) => params[key] !== undefined).map((key) => [key, params[key]!])),
    ...patch,
  };
  if (path === '/reports/aging' || path === '/reports/turnover') {
    target.sourceMovement = target.movements || target.movement!;
    delete target.movement;
    delete target.movements;
    delete target.types;
  }
  if (path === '/reports/aging') target.cutoffDay = patch.cutoffDay ?? params.cutoffDay ?? params.toDay!;
  return path + '?' + new URLSearchParams(Object.entries(target).filter(([, v]) => v !== ''));
}
export function monthRange(params: ListParams, month: string): ListParams {
  const first = month + '-01',
    last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  return {
    fromDay: first > params.fromDay! ? first : params.fromDay!,
    toDay: last < params.toDay! ? last : params.toDay!,
  };
}
export function rowDrilldown(kind: string, params: ListParams, row: Record<string, unknown>): string | undefined {
  const exact = { warehouseCodes: String(row.warehouseCode), productCode: String(row.productCode) };
  if (kind === 'report-monthly')
    return reportDrilldown('/reports/details', params, { ...monthRange(params, String(row.period)), ...exact });
  if (kind === 'report-turnover')
    return reportDrilldown('/reports/details', params, {
      ...exact,
      movement: 'outbound',
      movements: '',
      drilldown: 'turnover',
    });
  if (kind === 'report-aging')
    return canOpenStock(params)
      ? reportDrilldown('/stock', params, { ...exact, cutoffDay: params.cutoffDay!, drilldown: 'aging' })
      : undefined;
  if (kind === 'report-details' && row.documentId)
    return reportDrilldown(
      `/${row.directionLabel === '入库' ? 'inbound' : 'outbound'}/${encodeURIComponent(String(row.documentId))}`,
      params,
      exact,
    );
  return undefined;
}
export function canOpenStock(params: ListParams): boolean {
  return params.cutoffDay === new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
}
export function openReport(href: string | undefined): void {
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
}
export function cardDrilldown(kind: string, params: ListParams, index: number): string {
  if (kind === 'aging')
    return reportDrilldown('/reports/aging', params, { band: ['all', 'over90', 'unagedGrams'][index]! });
  return reportDrilldown('/reports/details', params, {
    movement: kind === 'turnover' ? 'outbound' : ['inbound', 'outbound', 'all'][index]!,
    movements: '',
    ...(kind === 'turnover' ? { drilldown: 'turnover' } : {}),
  });
}
export function chartDrilldown(
  kind: string,
  params: ListParams,
  event: { name: string; seriesIndex?: number },
): string {
  if (kind === 'aging')
    return reportDrilldown('/reports/aging', params, {
      band: [
        'age0To30Grams',
        'age31To90Grams',
        'age91To180Grams',
        'age181To365Grams',
        'ageOver365Grams',
        'unagedGrams',
      ][event.seriesIndex ?? 0]!,
    });
  if (kind === 'turnover') return reportDrilldown('/reports/turnover', params, monthRange(params, event.name));
  return reportDrilldown('/reports/details', params, {
    ...monthRange(params, event.name),
    movement: ['inbound', 'outbound', 'all'][event.seriesIndex ?? 0]!,
    movements: '',
  });
}
