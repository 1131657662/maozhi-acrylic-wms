import { z } from 'zod';

const fingerprint = z.string().regex(/^[a-f0-9]{64}$/);
const cell = z.object({ warehouse: z.string(), product: z.string(), packages: z.string(), tonnes: z.string() });
const inventory = z.object({ packages: z.string(), tonnes: z.string(), cells: z.array(cell) });
const baseline = z.object({
  capturedAt: z.iso.datetime(),
  tableCount: z.number().int().nonnegative(),
  tables: z.array(
    z.object({ name: z.string(), rows: z.number().int().nonnegative(), structure: fingerprint, content: fingerprint }),
  ),
  migrations: z.array(z.object({ id: z.string(), checksum: z.string(), state: z.string() })),
  documents: z.array(z.object({ kind: z.enum(['inbound', 'outbound']), number: z.string(), fingerprint })),
});
export const physicalBaselineSchema = baseline.extend({
  version: z.literal(2),
  inventory: inventory.extend({
    cells: z.array(cell.extend({ sourceDelFlag: z.union([z.literal(0), z.literal(1)]) })),
  }),
});
export const backupBaselineSchema = z.discriminatedUnion('version', [
  baseline.extend({ version: z.literal(1), inventory }),
  physicalBaselineSchema,
]);
export type BackupBaseline = z.infer<typeof backupBaselineSchema>;
