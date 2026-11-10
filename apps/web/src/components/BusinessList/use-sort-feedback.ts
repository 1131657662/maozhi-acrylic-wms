import { startTransition, useOptimistic, type ThHTMLAttributes } from 'react';

export type SortOrder = 'ascending' | 'descending' | undefined;
export function useSortFeedback(props: ThHTMLAttributes<HTMLTableCellElement>, sort?: (order: SortOrder) => void) {
  const [order, setOrder] = useOptimistic(props['aria-sort']);
  const sortable = props.className?.includes('ant-table-column-has-sorters');
  const advance = () =>
    startTransition(() => {
      const next = order === 'ascending' ? 'descending' : order === 'descending' ? undefined : 'ascending';
      setOrder(next);
      sort?.(next);
    });
  return {
    'aria-sort': order,
    'data-sort-feedback': sortable ? (order ?? 'none') : undefined,
    onClick: ((event) => {
      if (sortable && sort) advance();
      else props.onClick?.(event);
    }) as ThHTMLAttributes<HTMLTableCellElement>['onClick'],
    onKeyDown: ((event) => {
      if (sortable && sort && event.key === 'Enter') {
        event.stopPropagation();
        advance();
      } else props.onKeyDown?.(event);
    }) as ThHTMLAttributes<HTMLTableCellElement>['onKeyDown'],
  };
}
