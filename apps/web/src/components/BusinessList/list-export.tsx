import type { Key } from 'react';
import type { ListTableProps } from './table-types';
import { ExportPanel } from '../../features/web-exports/panel';

export function ListExportPanel<Row extends { id: Key }>({
  data,
  state,
  name,
  columnPrefs,
  selection,
  refreshing,
  onOpen,
}: ListTableProps<Row> & { onOpen?: () => void }) {
  return (
    <div className="business-list-toolbar-slot">
      <ExportPanel
        onOpen={onOpen}
        refreshing={refreshing}
        context={{
          kind: name,
          query: state.params,
          columns: columnPrefs.visible,
          viewToken: data.viewToken ?? '',
          selected: selection.keys.map((id) => ({ id: String(id), token: selection.tokens[String(id)] ?? '' })),
          total: data.total,
          pageCount: data.items.length,
          matchedLineTotal: data.matchedTotals?.lineCount,
          matchedLinePageCount: data.items.reduce(
            (sum, row) => sum + Number((row as { matchedLineCount?: number }).matchedLineCount ?? 0),
            0,
          ),
        }}
      />
    </div>
  );
}
