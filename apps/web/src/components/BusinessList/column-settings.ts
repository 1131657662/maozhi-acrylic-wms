import { z } from 'zod';
import type { ColumnsState } from '@ant-design/pro-components';
import { LIST_COLUMN_WIDTH } from '@wms/contracts';

export const COLUMN_WIDTH = {
  ...LIST_COLUMN_WIDTH,
  statusMin: 90,
  status: 140,
  handle: 8,
  selection: 48,
  keyboardStep: 10,
} as const;
export const columnText = {
  resetLabel: '重置',
  resetWidths: '重置列宽',
  resetAll: '重置列设置',
  resize: '调整列宽',
  handle: '拖动调整列宽，双击恢复默认',
};
export const columnStateSchema = z.record(
  z.string(),
  z.object({
    show: z.boolean().optional(),
    order: z.number().int().nonnegative().optional(),
    fixed: z.enum(['left', 'right']).optional(),
    width: z.number().int().min(COLUMN_WIDTH.min).max(COLUMN_WIDTH.max).optional(),
  }),
);
export type ColumnState = ColumnsState & { width?: number };
export type ColumnStates = Record<string, ColumnState>;
export const clampWidth = (width: number): number =>
  Math.round(Math.min(COLUMN_WIDTH.max, Math.max(COLUMN_WIDTH.min, width)));
