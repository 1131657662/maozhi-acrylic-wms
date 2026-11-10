import { useState, useMemo } from 'react';
import type { ColumnsState, ProColumns } from '@ant-design/pro-components';
import { listFields, WEB_LIST_VIEW_SCHEMA_VERSION, type ExportKind } from '@wms/contracts';
import { columnStateSchema, clampWidth, type ColumnStates } from './column-settings';
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
function loadState(storageKey: string): ColumnStates {
  try {
    return columnStateSchema.parse(JSON.parse(localStorage.getItem(storageKey) ?? '{}'));
  } catch {
    return {};
  }
}
export function useListColumns<Row extends { id: React.Key }>(
  kind: ExportKind,
  columns: ProColumns<Row>[],
  identity: string,
): ListColumnPreferences<Row> {
  const storageKey = `b6b-list-columns:${encodeURIComponent(identity)}:${kind}:v${WEB_LIST_VIEW_SCHEMA_VERSION}`;
  const [stored, setStored] = useState(() => ({ key: storageKey, value: loadState(storageKey) }));
  const saved = stored.key === storageKey ? stored.value : loadState(storageKey);
  const all = useMemo(() => completeColumns(kind, columns), [kind, columns]);
  const value = useMemo(() => mergeColumns(kind, all, saved), [kind, all, saved]);
  const change = (next: ColumnStates) => {
    setStored((previous) =>
      previous.key === storageKey && JSON.stringify(previous.value) === JSON.stringify(next)
        ? previous
        : { key: storageKey, value: next },
    );
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* Keep this session's settings when storage is unavailable. */
    }
  };
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
  const onChange = (next: Record<string, ColumnsState>) =>
    change(
      Object.fromEntries(
        Object.entries(next).map(([key, settings]) => [key, { width: value[key]?.width, ...settings }]),
      ),
    );
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
    resetAll: () => change({}),
  };
}
