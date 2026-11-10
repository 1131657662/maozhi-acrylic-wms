import { useEffect, useRef, useState } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import type { ListColumnPreferences } from './use-list-columns';
import { columnKey } from './column-config';
import { COLUMN_WIDTH } from './column-settings';
import type { ResizeHeaderProps } from './resize-header';
import type { ListState } from './use-list-state';

export function useColumnLayout<Row>(
  columns: ProColumns<Row>[],
  preferences: ListColumnPreferences<Row>,
  state: ListState,
) {
  const root = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setContainerWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = columns
    .filter((column) => !column.hideInTable && preferences.value[columnKey(column)]?.show !== false)
    .reduce<number>((total, column) => total + Number(column.width), COLUMN_WIDTH.selection);
  const configured = columns.map((column) => {
    const key = columnKey(column);
    const label = typeof column.title === 'string' ? column.title : undefined;
    return {
      ...column,
      onHeaderCell: (): ResizeHeaderProps => ({
        columnLabel: label,
        columnKey: key,
        columnWidth: Number(column.width),
        resize: (next) => preferences.resize(key, next),
        resetWidth: () => preferences.resetWidth(key),
        sort: column.sorter
          ? (order) => {
              const body = root.current?.querySelector('.ant-table-body');
              if (body) body.scrollTop = 0;
              state.change({
                page: '1',
                sortBy: order ? String(column.dataIndex) : '',
                direction: order ? (order === 'ascending' ? 'asc' : 'desc') : '',
              });
            }
          : undefined,
      }),
    };
  });
  return { root, width, columns: configured, canResize: containerWidth > 0 };
}
