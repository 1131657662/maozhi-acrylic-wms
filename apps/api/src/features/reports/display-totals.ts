import { listFields, type ReportKind } from '@wms/contracts';
import { addExact } from './arithmetic.ts';

export function displayTotals(kind: ReportKind, rows: Record<string, unknown>[]): Record<string, number | null> {
  return Object.fromEntries(
    listFields[kind]
      .filter((f) => f.total !== false && ['integer', 'tonnes'].includes(f.type))
      .map((f) => {
        const values = rows.map((row) => row[f.key]);
        return [
          f.key,
          values.some((v) => v == null) ? null : values.reduce<number>((sum, value) => addExact(sum, Number(value)), 0),
        ];
      }),
  );
}
