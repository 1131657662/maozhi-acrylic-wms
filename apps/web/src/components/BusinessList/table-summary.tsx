import type { ReactNode } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { Table } from 'antd';
import { columnKey } from './column-config';
import type { ColumnStates } from './column-settings';

export type ListTableSummary<Row> = (rows: readonly Row[]) => Readonly<Record<string, ReactNode>>;

export function summaryColumns<Row>(columns: ProColumns<Row>[], preferences: ColumnStates) {
  const group = (fixed: unknown) => (fixed === 'left' ? 0 : fixed === 'right' ? 2 : 1);
  return columns
    .filter((column) => !column.hideInTable && preferences[columnKey(column)]?.show !== false)
    .sort((a, b) => {
      const x = preferences[columnKey(a)],
        y = preferences[columnKey(b)];
      return group(x?.fixed) - group(y?.fixed) || (x?.order ?? 0) - (y?.order ?? 0);
    });
}

export function renderTableSummary<Row>(props: {
  columns: ProColumns<Row>[];
  preferences: ColumnStates;
  cells: Readonly<Record<string, ReactNode>>;
}) {
  return (
    <Table.Summary fixed="bottom">
      <Table.Summary.Row>
        <Table.Summary.Cell index={0} />
        {summaryColumns(props.columns, props.preferences).map((column, index) => (
          <Table.Summary.Cell key={columnKey(column)} index={index + 1} align={column.align}>
            <span data-summary-field={columnKey(column)}>{props.cells[columnKey(column)] ?? '—'}</span>
          </Table.Summary.Cell>
        ))}
      </Table.Summary.Row>
    </Table.Summary>
  );
}
