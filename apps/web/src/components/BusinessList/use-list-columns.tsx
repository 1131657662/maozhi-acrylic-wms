import { useState, useMemo } from 'react';
import type { ColumnsState, ProColumns } from '@ant-design/pro-components';
import { z } from 'zod';
import { listFields, listCellText, WEB_LIST_VIEW_SCHEMA_VERSION, type ExportKind } from '@wms/contracts';

const stateSchema = z.record(
  z.string(),
  z.object({ show: z.boolean().optional(), order: z.number().optional(), fixed: z.enum(['left', 'right']).optional() }),
);
export interface ListColumnPreferences<Row> {
  configured: ProColumns<Row>[];
  visible: string[];
  value: Record<string, ColumnsState>;
  state: { value: Record<string, ColumnsState>; onChange: (next: Record<string, ColumnsState>) => void };
  apply: (next: Record<string, ColumnsState>) => void;
}
function loadState(storageKey: string): Record<string, ColumnsState> {
  try {
    return stateSchema.parse(JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
  } catch {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Invalid or unavailable preferences fall back to defaults. */
    }
    return {};
  }
}
export function useListColumns<Row extends { id: React.Key }>(
  kind: ExportKind,
  columns: ProColumns<Row>[],
  identity: string,
): ListColumnPreferences<Row> {
  const storageKey = `b6b-list-columns:${encodeURIComponent(identity)}:${kind}:v${WEB_LIST_VIEW_SCHEMA_VERSION}`;
  const [stored, setStored] = useState<{ key: string; value: Record<string, ColumnsState> }>(() => ({
    key: storageKey,
    value: loadState(storageKey),
  }));
  const saved = stored.key === storageKey ? stored.value : loadState(storageKey);
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
    setStored((previous) =>
      previous.key === storageKey && JSON.stringify(previous.value) === JSON.stringify(next)
        ? previous
        : { key: storageKey, value: next },
    );
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Column choices remain valid in this session. */
    }
  };
  const configured = useMemo(() => columns.map((c) => displayColumn(kind, c)), [kind, columns]);
  const visible = configured
    .filter(
      (c) =>
        c.dataIndex &&
        listFields[kind].some((field) => field.key === c.dataIndex) &&
        value[String(c.dataIndex)]?.show !== false,
    )
    .sort((a, b) => {
      const x = value[String(a.dataIndex)]!;
      const y = value[String(b.dataIndex)]!;
      const group = (fixed: unknown) => (fixed === 'left' ? 0 : fixed === 'right' ? 2 : 1);
      return group(x.fixed) - group(y.fixed) || (x.order ?? 0) - (y.order ?? 0);
    })
    .map((c) => String(c.dataIndex));
  return { configured, visible, value, state: { value, onChange: change }, apply: change };
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
