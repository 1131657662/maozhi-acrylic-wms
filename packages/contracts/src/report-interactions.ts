import { z } from 'zod';
export const REPORT_EXPORT_EXPIRED = '数据已变化，请刷新后重新导出';
export function publicReportText(value: string): string {
  return value
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '（追踪信息已隐藏）')
    .replace(/\b[0-9a-f]{64}\b/gi, '（快照信息已隐藏）');
}

export const reportTypeLabels = { inbound: '入库', outbound: '出库', reversal: '撤销', correction: '更正' } as const;
export const reportMovementLabels = { inbound: '入库', outbound: '出库' } as const;
export const agingBandLabels = {
  all: '全部库龄',
  age0To30Grams: '0–30 天',
  age31To90Grams: '31–90 天',
  age91To180Grams: '91–180 天',
  age181To365Grams: '181–365 天',
  ageOver365Grams: '>365 天',
  over90: '超 90 天',
  unagedGrams: '不可归龄',
} as const;
export const agingBandSchema = z.enum(
  Object.keys(agingBandLabels) as [keyof typeof agingBandLabels, ...(keyof typeof agingBandLabels)[]],
);
export function reportSelections(value?: string): string[] {
  return value ? [...new Set(value.split(',').filter(Boolean))] : [];
}
const selection = z
  .string()
  .max(4000)
  .refine((s) => reportSelections(s).length <= 100);
export const reportDimensionFields = {
  warehouseCodes: selection.optional(),
  productCode: z.string().trim().max(200).optional(),
};
export const reportMovementFields = {
  movements: selection
    .refine((s) => reportSelections(s).every((v) => Object.hasOwn(reportMovementLabels, v)))
    .optional(),
  types: selection.refine((s) => reportSelections(s).every((v) => Object.hasOwn(reportTypeLabels, v))).optional(),
};
const facetSchema = z.strictObject({ value: z.string(), label: z.string(), count: z.number().int().nonnegative() });
export const reportFacetsSchema = z.strictObject({
  warehouses: z.array(facetSchema),
  movements: z.array(facetSchema),
  types: z.array(facetSchema),
});
export type ReportFacets = z.infer<typeof reportFacetsSchema>;
