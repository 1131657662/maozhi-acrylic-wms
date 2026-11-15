import type { ReportMonthlyChart, ReportMonthlyRow } from '@wms/contracts';
import { addExact } from './arithmetic.ts';
import { recordMonthlyDocument, type MonthlyDocuments } from './monthly-documents.ts';
import type { Projection } from './types.ts';
import type { Restatement } from './restated.ts';

function movementTotal(rows: ReportMonthlyRow[]) {
  const result = { inboundGrams: 0, outboundGrams: 0, netGrams: 0, inboundPackages: 0, outboundPackages: 0 };
  for (const row of rows)
    for (const key of Object.keys(result) as (keyof typeof result)[]) result[key] = addExact(result[key], row[key]);
  return result;
}
export function monthlyChart(
  projection: Projection,
  restated?: Pick<Restatement, 'events' | 'monthly'>,
): ReportMonthlyChart {
  const rows = restated?.monthly ?? projection.monthly;
  const counts = restated ? new Map<string, MonthlyDocuments>() : projection.monthlyDocuments;
  if (restated)
    for (const event of restated.events) {
      const day = event.reportingDate;
      if (day && day >= projection.metadata.fromDay && day <= projection.metadata.toDay)
        recordMonthlyDocument(counts, event, day);
    }
  const groups = new Map<string, ReportMonthlyRow[]>();
  for (const row of rows) {
    const group = groups.get(row.period) ?? [];
    group.push(row);
    groups.set(row.period, group);
  }
  const points = [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, items]) => ({
      month,
      ...movementTotal(items),
      inboundDocuments: counts.get(month)?.missingInbound ? null : (counts.get(month)?.inbound.size ?? 0),
      outboundDocuments: counts.get(month)?.missingOutbound ? null : (counts.get(month)?.outbound.size ?? 0),
    }));
  return {
    points,
    totals: movementTotal(rows),
    empty: ![...counts.values()].some((item) => item.activity > 0),
    reasons: projection.metadata.missingTime ? ['存在时间未核实的流水，图表仅包含可归期的发生额'] : [],
  };
}
