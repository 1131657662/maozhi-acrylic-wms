import { useEffect, useRef, type Key, type MouseEvent, type KeyboardEvent } from 'react';
import type { ListTableProps } from './table-types';
import type { ListSelectionRow } from './use-list-selection';
import { isInteractiveTarget } from './table-helpers';

export const ROW_CLICK_DELAY_MS = 250;
interface Options<Row extends { id: Key }> {
  scope: string;
  selection: ListTableProps<Row>['selection'];
  rows: ListSelectionRow[];
  open: (row: Row) => void;
}

export function useRowInteractions<Row extends { id: Key }>({ scope, selection, rows, open }: Options<Row>) {
  const pending = useRef(new Map<Key, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = pending.current;
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [scope]);
  const cancel = (id: Key) => {
    clearTimeout(pending.current.get(id));
    pending.current.delete(id);
  };
  const toggle = (id: Key) =>
    selection.change((keys) => (keys.includes(id) ? keys.filter((key) => key !== id) : [...keys, id]), rows);
  const click = (event: MouseEvent<HTMLTableRowElement>, row: Row) => {
    cancel(row.id);
    if (
      event.button !== 0 ||
      event.detail > 1 ||
      isInteractiveTarget(event.target) ||
      window.getSelection()?.toString()
    )
      return;
    event.currentTarget.focus({ preventScroll: true });
    pending.current.set(
      row.id,
      setTimeout(() => {
        pending.current.delete(row.id);
        if (!window.getSelection()?.toString()) toggle(row.id);
      }, ROW_CLICK_DELAY_MS),
    );
  };
  const keydown = (event: KeyboardEvent<HTMLTableRowElement>, row: Row) => {
    if (isInteractiveTarget(event.target) || ![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    cancel(row.id);
    if (!event.repeat) event.key === ' ' ? toggle(row.id) : open(row);
  };
  return (row: Row) => ({
    tabIndex: 0,
    'aria-selected': selection.keys.includes(row.id),
    onClick: (event: MouseEvent<HTMLTableRowElement>) => click(event, row),
    onDoubleClick: (event: MouseEvent<HTMLTableRowElement>) => {
      cancel(row.id);
      if (!isInteractiveTarget(event.target)) open(row);
    },
    onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => keydown(event, row),
  });
}
