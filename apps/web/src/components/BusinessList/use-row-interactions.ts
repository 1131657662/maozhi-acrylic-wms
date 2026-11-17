import type { Key, MouseEvent, KeyboardEvent } from 'react';
import type { ListTableProps } from './table-types';
import type { ListSelectionRow } from './use-list-selection';
import { isInteractiveTarget } from './table-helpers';

interface Options<Row extends { id: Key }> {
  selection: ListTableProps<Row>['selection'];
  rows: ListSelectionRow[];
  open: (row: Row) => void;
}

export function useRowInteractions<Row extends { id: Key }>({ selection, rows, open }: Options<Row>) {
  const toggle = (id: Key) =>
    selection.change((keys) => (keys.includes(id) ? keys.filter((key) => key !== id) : [...keys, id]), rows);
  const select = (id: Key) => selection.change((keys) => (keys.includes(id) ? keys : [...keys, id]), rows);
  const click = (event: MouseEvent<HTMLTableRowElement>, row: Row) => {
    if (
      event.button !== 0 ||
      isInteractiveTarget(event.target) ||
      (event.detail <= 1 && window.getSelection()?.toString())
    )
      return;
    event.currentTarget.focus({ preventScroll: true });
    if (event.detail > 1) select(row.id);
    else toggle(row.id);
  };
  const keydown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (isInteractiveTarget(event.target) || ![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) event.key === ' ' ? toggle(row.id) : open(row);
  };
  return (row: Row) => ({
    tabIndex: 0,
    'aria-selected': selection.keys.includes(row.id),
    onClick: (event: MouseEvent<HTMLTableRowElement>) => click(event, row),
    onDoubleClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (isInteractiveTarget(event.target)) return;
      select(row.id);
      open(row);
    },
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => keydown(event, row),
  });
}
