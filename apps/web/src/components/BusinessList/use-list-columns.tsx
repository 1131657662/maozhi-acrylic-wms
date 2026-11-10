import { useMemo } from 'react';
import type { ColumnsState, ProColumns } from '@ant-design/pro-components';
import { listFields, type ExportKind } from '@wms/contracts';
import { clampWidth, type ColumnStates } from './column-settings';
import { usePreferences } from '../../features/list-preferences/use-preferences';
import { columnKey, completeColumns, displayColumn, mergeColumns } from './column-config';

export interface ListColumnPreferences<Row> {
  configured: ProColumns<Row>[];
  visible: string[];
  value: ColumnStates;
  state: { value: ColumnStates; onChange: (next: Record<string, ColumnsState>) => void };
  apply: (next: ColumnStates) => void;
  resize: (key: string, width: number) => void;
  resetWidth: (key: string) => void;
  resetWidths: () => void;
  resetAll: () => void;
}
export function useListColumns<Row extends { id: React.Key }>(
  kind: ExportKind,
  columns: ProColumns<Row>[],
  identity: string,
): ListColumnPreferences<Row> {
  const { saved, change, reset } = usePreferences(identity, kind);
  const all = useMemo(() => completeColumns(kind, columns), [kind, columns]);
  const value = useMemo(() => mergeColumns(kind, all, saved), [kind, all, saved]);
  const configured = useMemo(
    () => all.map((column) => ({ ...displayColumn(kind, column), width: value[columnKey(column)]!.width })),
    [kind, all, value],
  );
  const visible = configured
    .filter(
      (c) =>
        c.dataIndex &&
        listFields[kind].some((field) => field.key === c.dataIndex) &&
        value[columnKey(c)]?.show !== false,
    )
    .sort((a, b) => {
      const x = value[columnKey(a)]!,
        y = value[columnKey(b)]!;
      const group = (fixed: unknown) => (fixed === 'left' ? 0 : fixed === 'right' ? 2 : 1);
      return group(x.fixed) - group(y.fixed) || (x.order ?? 0) - (y.order ?? 0);
    })
    .map((c) => String(c.dataIndex));
  const defaultWidth = (key: string) => Number(all.find((column) => columnKey(column) === key)!.width);
  const resize = (key: string, width: number) =>
    change({ ...value, [key]: { ...value[key], width: clampWidth(width) } });
  const onChange = (next: Record<string, ColumnsState>) => {
    const merged = mergeColumns(
      kind,
      all,
      Object.fromEntries(
        Object.entries(next).map(([key, settings]) => [key, { width: value[key]?.width, ...settings }]),
      ),
    );
    if (JSON.stringify(merged) !== JSON.stringify(value)) change(merged);
  };
  return {
    configured,
    visible,
    value,
    state: { value, onChange },
    apply: change,
    resize,
    resetWidth: (key) => resize(key, defaultWidth(key)),
    resetWidths: () =>
      change(
        Object.fromEntries(
          Object.entries(value).map(([key, settings]) => [key, { ...settings, width: defaultWidth(key) }]),
        ),
      ),
    resetAll: reset,
  };
}
