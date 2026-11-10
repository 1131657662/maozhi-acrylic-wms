import { z } from 'zod';
import { WEB_LIST_VIEW_SCHEMA_VERSION } from './list-display.ts';

export const LIST_COLUMN_WIDTH = { fallback: 120, min: 80, max: 600 } as const;
export const LIST_PREFERENCES = { debounceMs: 500, maxColumns: 128, maxKeyLength: 80, maxOrder: 1024 } as const;
export const listPreferenceColumnSchema = z.strictObject({
  show: z.boolean().optional(),
  order: z.number().int().min(0).max(LIST_PREFERENCES.maxOrder).optional(),
  fixed: z.enum(['left', 'right']).optional(),
  width: z.number().int().min(LIST_COLUMN_WIDTH.min).max(LIST_COLUMN_WIDTH.max).optional(),
});
export const listPreferenceColumnsSchema = z
  .record(
    z
      .string()
      .min(1)
      .max(LIST_PREFERENCES.maxKeyLength)
      .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/),
    listPreferenceColumnSchema,
  )
  .refine((columns) => Object.keys(columns).length <= LIST_PREFERENCES.maxColumns);
export const listPreferencesInputSchema = z.strictObject({
  schemaVersion: z.number().int().min(0).max(WEB_LIST_VIEW_SCHEMA_VERSION),
  columns: listPreferenceColumnsSchema,
});
export const listPreferencesSchema = z.strictObject({
  schemaVersion: z.literal(WEB_LIST_VIEW_SCHEMA_VERSION),
  columns: listPreferenceColumnsSchema,
  updatedAt: z.string().nullable(),
});
export type ListPreferenceColumns = z.infer<typeof listPreferenceColumnsSchema>;
export type ListPreferencesInput = z.infer<typeof listPreferencesInputSchema>;
export type ListPreferences = z.infer<typeof listPreferencesSchema>;
