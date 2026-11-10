import { clampWidth } from './column-settings';

type StyleChange = { node: HTMLElement; property: string; original: string; base: number };
const tablesSelector = '.ant-table-header > table,.ant-table-body > table,.ant-table-content > table';

function change(node: HTMLElement, property: string, base: number): StyleChange {
  return { node, property, original: node.style.getPropertyValue(property), base };
}

function tableChanges(table: HTMLTableElement, index: number): StyleChange[] {
  const columns = table.querySelectorAll<HTMLTableColElement>(':scope > colgroup > col');
  const column = columns[index];
  const changes = [change(table, 'width', table.getBoundingClientRect().width)];
  if (column) changes.push(change(column, 'width', parseFloat(column.style.width)));
  for (const cell of table.querySelectorAll<HTMLTableCellElement>('th,td')) {
    if (cell.closest('table') !== table) continue;
    if (cell.tagName === 'TH' && cell.cellIndex === index)
      changes.push(change(cell, 'width', cell.getBoundingClientRect().width));
    if (cell.style.insetInlineStart && cell.cellIndex > index)
      changes.push(change(cell, 'inset-inline-start', parseFloat(cell.style.insetInlineStart)));
    if (cell.style.insetInlineEnd && cell.cellIndex < index)
      changes.push(change(cell, 'inset-inline-end', parseFloat(cell.style.insetInlineEnd)));
  }
  return changes;
}

function suspendMeasurements(root: Element) {
  // rc-table measures every column via ResizeObserver. Suspend its hidden measuring
  // row during the DOM preview so pointer moves cannot trigger React table renders.
  const rows = Array.from(root.querySelectorAll<HTMLElement>('.ant-table-measure-row'));
  const previous = rows.map((row) => row.style.display);
  rows.forEach((row) => {
    row.style.display = 'none';
  });
  return () =>
    rows.forEach((row, index) => {
      row.style.display = previous[index]!;
    });
}

function lockScroll(root: Element) {
  const releases = Array.from(
    root.querySelectorAll<HTMLElement>('.ant-table-body,.ant-table-content,.ant-table-header'),
  ).map((node) => {
    const left = node.scrollLeft;
    const hold = () => {
      if (node.scrollLeft !== left) node.scrollLeft = left;
    };
    node.addEventListener('scroll', hold);
    return () => node.removeEventListener('scroll', hold);
  });
  const previous = document.body.style.userSelect;
  document.body.style.userSelect = 'none';
  return () => {
    releases.forEach((release) => release());
    document.body.style.userSelect = previous;
  };
}

export function createResizePreview(header: HTMLTableCellElement, width: number) {
  const root = header.closest('[data-table-resize-root]')!;
  const changes = Array.from(root.querySelectorAll<HTMLTableElement>(tablesSelector)).flatMap((table) =>
    tableChanges(table, header.cellIndex),
  );
  const resume = suspendMeasurements(root);
  const unlock = lockScroll(root);
  let frame = 0;
  let next = width;
  const paint = () => {
    frame = 0;
    changes.forEach(({ node, property, base }) => node.style.setProperty(property, `${base + next - width}px`));
  };
  return {
    move(value: number) {
      next = clampWidth(value);
      if (!frame) frame = requestAnimationFrame(paint);
    },
    finish() {
      cancelAnimationFrame(frame);
      changes.forEach(({ node, property, original }) => node.style.setProperty(property, original));
      resume();
      unlock();
      return next;
    },
  };
}
