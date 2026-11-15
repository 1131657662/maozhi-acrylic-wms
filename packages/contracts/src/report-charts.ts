import { z } from 'zod';

const integer = z.number().int().safe();
const chartState = { empty: z.boolean(), reasons: z.array(z.string()) };
const movements = {
  inboundGrams: integer,
  outboundGrams: integer,
  netGrams: integer,
  inboundPackages: integer,
  outboundPackages: integer,
};
export const reportMonthlyChartSchema = z.strictObject({
  ...chartState,
  totals: z.strictObject(movements),
  points: z.array(
    z.strictObject({
      month: z.string(),
      ...movements,
      inboundDocuments: integer.nullable(),
      outboundDocuments: integer.nullable(),
    }),
  ),
});
export const turnoverMetricsSchema = z.strictObject({
  days: integer,
  netOutboundGrams: integer.nullable(),
  dailyClosingGramsSum: integer.nullable(),
  turns: z.string().nullable(),
  turnoverDays: z.string().nullable(),
  reasons: z.array(z.string()),
});
export const reportTurnoverChartSchema = z.strictObject({
  ...chartState,
  totals: turnoverMetricsSchema,
  points: z.array(turnoverMetricsSchema.extend({ month: z.string(), fromDay: z.iso.date(), toDay: z.iso.date() })),
});
export const reportAgingChartSchema = z.strictObject({
  ...chartState,
  buckets: z.tuple([
    integer.nullable(),
    integer.nullable(),
    integer.nullable(),
    integer.nullable(),
    integer.nullable(),
  ]),
  unagedGrams: integer.nullable(),
  closingGrams: integer.nullable(),
  over90Percent: z.string().nullable(),
});
export type ReportMonthlyChart = z.infer<typeof reportMonthlyChartSchema>;
export type ReportTurnoverChart = z.infer<typeof reportTurnoverChartSchema>;
export type ReportAgingChart = z.infer<typeof reportAgingChartSchema>;
export type TurnoverMetrics = z.infer<typeof turnoverMetricsSchema>;
