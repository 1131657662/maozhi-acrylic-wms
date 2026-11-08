import { useState, useMemo } from 'react';
import type { ColumnsState, ProColumns } from '@ant-design/pro-components';
import { z } from 'zod';
import { listFields, listCellText, type ExportKind } from '@wms/contracts';

const stateSchema = z.record(
  z.string(),
  z.object({ show: z.boolean().optional(), order: z.number().optional(), fixed: z.enum(['left', 'right']).optional() }),
);
export function useListColumns<Row extends { id: React.Key }>(kind: ExportKind, columns: ProColumns<Row>[]) {
  const storageKey = `b1b-${kind}-columns-v1`;
  const [saved, setSaved] = useState<Record<string, ColumnsState>>(() => {
    try {
      return stateSchema.parse(JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
    } catch {
      return {};
    }
  });
  const value = useMemo(
    () =>
      Object.fromEntries(
        columns.map((c, index) => {
          const key = String(c.key ?? c.dataIndex);
          const fixed: ColumnsState['fixed'] =
            c.fixed === true || c.fixed === 'left' || c.fixed === 'start'
              ? 'left'
              : c.fixed === 'right' || c.fixed === 'end'
                ? 'right'
                : undefined;
          const defaults = { show: !listFields[kind].find((f) => f.key === key)?.defaultHidden, fixed, order: index };
          return [key, c.hideInSetting ? defaults : { ...defaults, ...saved[key] }];
        }),
      ),
    [columns, saved, kind],
  );
  const change = (next: Record<string, ColumnsState>) => {
    setSaved((previous) => (JSON.stringify(previous) === JSON.stringify(next) ? previous : next));
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Column choices remain valid in this session. */
    }
  };
  const configured = useMemo(() => columns.map((c) => displayColumn(kind, c)), [kind, columns]);
  const visible = configured
    .filter((c) => c.dataIndex && value[String(c.dataIndex)]?.show !== false)
    .sort((a, b) => {
      const x = value[String(a.dataIndex)]!;
      const y = value[String(b.dataIndex)]!;
      const group = (fixed: unknown) => (fixed === 'left' ? 0 : fixed === 'right' ? 2 : 1);
      return group(x.fixed) - group(y.fixed) || (x.order ?? 0) - (y.order ?? 0);
    })
    .map((c) => String(c.dataIndex));
  return { configured, visible, state: { value, onChange: change } };
}
function displayColumn<Row>(kind: ExportKind, column: ProColumns<Row>): ProColumns<Row> {
  const field = listFields[kind].find((f) => f.key === column.dataIndex);
  if (!field) return column;
  const preserve =
    ['receiptNo', 'orderNo', 'status'].includes(field.key) ||
    (kind === 'stock' && ['packages', 'weightGrams'].includes(field.key));
  return {
    ...column,
    title: field.label,
    onCell: () => ({ 'data-export-field': field.key }) as React.HTMLAttributes<HTMLElement>,
    render: preserve ? column.render : (_, row) => listCellText(kind, field, row as Record<string, unknown>),
  };
}
