import { z } from 'zod';
import { webListKindSchema } from './web-list-query.ts';
import { reportKindSchema } from './reports.ts';
export const exportKindSchema = z.enum([...webListKindSchema.options, ...reportKindSchema.options]);
export type ExportKind = z.infer<typeof exportKindSchema>;
