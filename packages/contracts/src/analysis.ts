import { z } from 'zod';

const integer = z.number().int().safe();
const basis = z.enum(['posted', 'restated']);
const verification = z.enum(['verified', 'unverifiable', 'failed']);
const day = z.iso.date();

export const ANALYSIS = {
  ttlMs: 30_000,
  topLimit: 10,
  monthlyTrendMonths: 12,
  turnoverMonths: 6,
  heatmapDays: 183,
} as const;

export const analysisQuerySchema = z
  .strictObject({
    fromDay: day,
    toDay: day,
    basis: basis.default('posted'),
  })
  .refine(
    (query) => query.fromDay <= query.toDay && Date.parse(query.toDay) - Date.parse(query.fromDay) <= 366 * 86_400_000,
    '请选择不超过 367 天的有效日期范围',
  );
export type AnalysisQuery = z.infer<typeof analysisQuerySchema>;

const period = z.strictObject({ fromDay: day, toDay: day });
export function analysisBlockSchema<T extends z.ZodType>(data: T) {
  return z.strictObject({
    data: data.nullable(),
    unit: z.enum(['克', '小时', '次/天']),
    period,
    basis,
    verification,
    reason: z.string().nullable(),
  });
}

const movement = z.strictObject({ inboundGrams: integer.nullable(), outboundGrams: integer.nullable() });
const monthly = z.strictObject({
  points: z.array(z.strictObject({ month: z.string(), ...movement.shape })),
});
const comparisonSide = z.strictObject({
  fromDay: day,
  toDay: day,
  inboundGrams: integer.nullable(),
  outboundGrams: integer.nullable(),
});
const comparison = z.strictObject({ current: comparisonSide, previous: comparisonSide });
const topItem = z.strictObject({
  code: z.string(),
  name: z.string().nullable(),
  inboundGrams: integer,
  outboundGrams: integer,
  rankedGrams: integer,
});
const tops = z.strictObject({
  products: z.array(topItem).max(ANALYSIS.topLimit),
  customers: z.array(topItem).max(ANALYSIS.topLimit),
  suppliers: z.array(topItem).max(ANALYSIS.topLimit),
});
const aging = z.strictObject({
  buckets: z.tuple([
    integer.nullable(),
    integer.nullable(),
    integer.nullable(),
    integer.nullable(),
    integer.nullable(),
  ]),
  unagedGrams: integer.nullable(),
  closingGrams: integer.nullable(),
});
const turnover = z.array(
  z.strictObject({
    month: z.string(),
    turns: z.string().nullable(),
    turnoverDays: z.string().nullable(),
    reasons: z.array(z.string()),
  }),
);
const heatmap = z.strictObject({
  days: z
    .array(
      z.strictObject({
        day,
        value: integer.nullable(),
        inboundGrams: integer.nullable(),
        outboundGrams: integer.nullable(),
      }),
    )
    .length(ANALYSIS.heatmapDays),
});
const duration = z.strictObject({
  inboundAverageHours: z.number().finite().nullable(),
  inboundCompleted: integer,
  outboundAverageHours: z.number().finite().nullable(),
  outboundCompleted: integer,
  longestPending: z
    .strictObject({
      kind: z.enum(['inbound', 'outbound']),
      number: z.string(),
      createdAt: z.iso.datetime(),
      elapsedHours: z.number().finite().nonnegative(),
    })
    .nullable(),
});

export const analysisSchema = z.strictObject({
  asOf: z.iso.datetime(),
  watermark: z.string(),
  fromDay: day,
  toDay: day,
  basis,
  monthly: analysisBlockSchema(monthly),
  comparison: analysisBlockSchema(comparison),
  tops: analysisBlockSchema(tops),
  aging: analysisBlockSchema(aging),
  turnover: analysisBlockSchema(turnover),
  heatmap: analysisBlockSchema(heatmap),
  duration: analysisBlockSchema(duration),
});
export type Analysis = z.infer<typeof analysisSchema>;
