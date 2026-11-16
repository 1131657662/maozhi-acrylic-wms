import type { AnalysisBlock } from './analysis-section';
import { reportDrilldown, monthRange } from '../reports/drilldown';

export function analysisLink(kind: string, block: AnalysisBlock<unknown>, value: string): string {
  const params = { ...block.period, basis: block.basis };
  if (kind === 'monthly' || kind === 'turnover')
    return reportDrilldown(`/reports/${kind}`, params, monthRange(params, value));
  if (kind === 'day') return reportDrilldown('/reports/details', params, { fromDay: value, toDay: value });
  if (kind === 'product') return reportDrilldown('/reports/details', params, { productCode: value });
  if (kind === 'aging') return reportDrilldown('/reports/aging', params, { band: value });
  if (kind === 'customer') return '/outbound?' + new URLSearchParams({ customer: value });
  const data = block.data as { current: typeof params; previous: typeof params };
  return reportDrilldown('/reports/monthly', params, value === 'previous' ? data.previous : data.current);
}
