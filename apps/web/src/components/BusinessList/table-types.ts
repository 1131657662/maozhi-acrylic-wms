import type { Key, ReactNode } from 'react';
import type { TableProps } from 'antd';
import type { ExportKind, WebMatchedTotals } from '@wms/contracts';
import type { ListColumnPreferences } from './use-list-columns';
import type { ListState } from './use-list-state';
import type { ListSelectionRow, SelectionKeys } from './use-list-selection';
import type { ListTableSummary } from './table-summary';

export interface ListData<Row> {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  viewToken?: string;
  rowTokens?: Record<string, string>;
  matchedTotals?: WebMatchedTotals;
}
export interface ListTableProps<Row> {
  data: ListData<Row>;
  state: ListState;
  name: ExportKind;
  refreshing: boolean;
  placeholder: boolean;
  reload: () => unknown;
  selection: {
    tokens: Record<string, string>;
    keys: Key[];
    rows: Record<string, ListSelectionRow>;
    change: (keys: SelectionKeys, rows?: ListSelectionRow[]) => void;
  };
  columnPrefs: ListColumnPreferences<Row>;
  emptyText?: ReactNode;
  exportInHeader?: boolean;
  tableSummary?: ListTableSummary<Row>;
  expandable?: TableProps<Row>['expandable'];
}
