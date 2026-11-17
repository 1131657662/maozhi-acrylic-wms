import { z } from 'zod';

const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
export const backupBaselineSchema = z.object({
  version: z.literal(1),
  capturedAt: z.iso.datetime(),
  tableCount: z.number().int().nonnegative(),
  tables: z.array(
    z.object({ name: z.string(), rows: z.number().int().nonnegative(), structure: fingerprint, content: fingerprint }),
  ),
  inventory: z.object({
    packages: z.string(),
    tonnes: z.string(),
    cells: z.array(z.object({ warehouse: z.string(), product: z.string(), packages: z.string(), tonnes: z.string() })),
  }),
  migrations: z.array(z.object({ id: z.string(), checksum: z.string(), state: z.string() })),
  documents: z.array(z.object({ kind: z.enum(['inbound', 'outbound']), number: z.string(), fingerprint })),
});
export type BackupBaseline = z.infer<typeof backupBaselineSchema>;
