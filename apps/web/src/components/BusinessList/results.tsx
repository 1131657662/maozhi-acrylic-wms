import type { ExportKind } from '@wms/contracts';
import type { Key, ReactNode } from 'react';
import { ListTable, type ListData } from './table';
import type { ListColumnPreferences } from './use-list-columns';
import type { ListState } from './use-list-state';
import type { ListSelectionRow, SelectionKeys } from './use-list-selection';
import { SectionTitle } from '../ui';
import { spacing } from '../../theme/design-tokens';

interface ResultsProps<Row extends { id: Key }> {
  config: { name: ExportKind; exportInHeader?: boolean; resultCardTitle?: ReactNode };
  data: ListData<Row>;
  state: ListState;
  selection: {
    tokens: Record<string, string>;
    keys: Key[];
    rows: Record<string, ListSelectionRow>;
    change: (keys: SelectionKeys, rows?: ListSelectionRow[]) => void;
  };
  columnPrefs: ListColumnPreferences<Row>;
  refreshing: boolean;
  placeholder: boolean;
  reload: () => unknown;
  summary?: ReactNode;
  emptyText?: ReactNode;
}
export function ListResults<Row extends { id: Key }>({
  config,
  data,
  state,
  selection,
  columnPrefs,
  refreshing,
  placeholder,
  reload,
  summary,
  emptyText,
}: ResultsProps<Row>) {
  const table = (
    <ListTable
      name={config.name}
      data={data}
      state={state}
      refreshing={refreshing}
      placeholder={placeholder}
      reload={reload}
      selection={selection}
      columnPrefs={columnPrefs}
      emptyText={emptyText}
      exportInHeader={config.exportInHeader}
    />
  );
  return (
    <section
      data-testid={config.name + '-list'}
      style={
        config.resultCardTitle
          ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: spacing[8], minWidth: 0 }
          : undefined
      }
    >
      {summary}
      {config.resultCardTitle && <SectionTitle title={config.resultCardTitle} />}
      {table}
    </section>
  );
}
