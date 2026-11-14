import type { HTMLAttributes } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { listFields, listCellText, type ExportKind } from '@wms/contracts';
import { COLUMN_WIDTH, clampWidth, type ColumnStates } from './column-settings';

export const columnKey = <Row>(column: ProColumns<Row>): string => String(column.key ?? column.dataIndex);

export function completeColumns<Row>(kind: ExportKind, columns: ProColumns<Row>[]): ProColumns<Row>[] {
  const missing = listFields[kind].filter(
    (field) => field.defaultHidden && !columns.some((c) => columnKey(c) === field.key),
  );
  const extras: ProColumns<Row>[] = missing.map((field) => ({
    key: field.key,
    dataIndex: field.key,
    title: field.label,
    width: COLUMN_WIDTH.fallback,
    ellipsis: true,
  }));
  return [
    ...columns.filter((c) => c.valueType !== 'option'),
    ...extras,
    ...columns.filter((c) => c.valueType === 'option'),
  ].map((column) => ({
    ...column,
    key: columnKey(column),
    width: typeof column.width === 'number' ? clampWidth(column.width) : COLUMN_WIDTH.fallback,
  }));
}

export function mergeColumns<Row>(kind: ExportKind, columns: ProColumns<Row>[], saved: ColumnStates): ColumnStates {
  return Object.fromEntries(
    columns.map((column, index) => {
      const key = columnKey(column);
      const fixed: 'left' | 'right' | undefined =
        column.fixed === true || column.fixed === 'left' || column.fixed === 'start'
          ? 'left'
          : column.fixed === 'right' || column.fixed === 'end'
            ? 'right'
            : undefined;
      const defaults = {
        show: !column.hideInTable && !listFields[kind].find((field) => field.key === key)?.defaultHidden,
        fixed,
        order: index,
        width: Number(column.width),
      };
      return [
        key,
        column.hideInSetting
          ? { ...defaults, width: saved[key]?.width ?? defaults.width }
          : { ...defaults, ...saved[key], ...(['inbound', 'outbound'].includes(kind) ? { fixed } : {}) },
      ];
    }),
  );
}

export function displayColumn<Row>(kind: ExportKind, column: ProColumns<Row>): ProColumns<Row> {
  const field = listFields[kind].find((f) => f.key === column.dataIndex);
  if (!field) return column;
  const preserve =
    (kind === 'audit' && ['action', 'objectLabel', 'result'].includes(field.key)) ||
    ['receiptNo', 'orderNo', 'status'].includes(field.key) ||
    (kind === 'stock' && ['packages', 'weightGrams', 'pending', 'available'].includes(field.key));
  return {
    ...column,
    hideInTable: false,
    title: field.label,
    ellipsis: column.ellipsis ?? true,
    onCell: (row, index) =>
      ({ ...column.onCell?.(row, index), 'data-export-field': field.key }) as HTMLAttributes<HTMLElement>,
    render: preserve ? column.render : (_, row) => listCellText(kind, field, row as Record<string, unknown>),
  };
}
