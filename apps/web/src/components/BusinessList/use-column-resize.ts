import { useEffect, useRef, type PointerEvent, type KeyboardEvent, type RefObject } from 'react';
import { COLUMN_WIDTH } from './column-settings';
import { createResizePreview } from './resize-preview';

interface Actions {
  resize?: (width: number) => void;
  resetWidth?: () => void;
}
interface Drag {
  x: number;
  width: number;
  preview: ReturnType<typeof createResizePreview>;
}
type DragRef = RefObject<Drag | null>;

function cancel(drag: DragRef): void {
  drag.current?.preview.finish();
  drag.current = null;
}

function start(event: PointerEvent<HTMLSpanElement>, drag: DragRef): void {
  if (event.button !== 0) return;
  event.stopPropagation();
  event.preventDefault();
  cancel(drag);
  const width = Number(event.currentTarget.getAttribute('aria-valuenow'));
  const header = event.currentTarget.closest('th')!;
  const minimum = Number(event.currentTarget.getAttribute('aria-valuemin'));
  drag.current = { x: event.clientX, width, preview: createResizePreview(header, width, minimum) };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function commit(event: PointerEvent<HTMLSpanElement>, drag: DragRef, actions: Actions): void {
  event.stopPropagation();
  const current = drag.current;
  if (!current) return;
  current.preview.move(current.width + event.clientX - current.x);
  const width = current.preview.commit();
  drag.current = null;
  event.currentTarget.setAttribute('aria-valuenow', String(width));
  if (width !== current.width) actions.resize?.(width);
  event.currentTarget.releasePointerCapture(event.pointerId);
}

function keyDown(event: KeyboardEvent<HTMLSpanElement>, actions: Actions): void {
  event.stopPropagation();
  if (event.key === 'Home') {
    event.preventDefault();
    actions.resetWidth?.();
  }
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const width = Number(event.currentTarget.getAttribute('aria-valuenow'));
  const minimum = Number(event.currentTarget.getAttribute('aria-valuemin'));
  const preview = createResizePreview(event.currentTarget.closest('th')!, width, minimum);
  preview.move(width + (event.key === 'ArrowRight' ? COLUMN_WIDTH.keyboardStep : -COLUMN_WIDTH.keyboardStep));
  const next = preview.commit();
  event.currentTarget.setAttribute('aria-valuenow', String(next));
  actions.resize?.(next);
}

export function useColumnResize(actions: Actions) {
  const drag = useRef<Drag | null>(null);
  useEffect(() => () => cancel(drag), []);
  return {
    onPointerDown: (event: PointerEvent<HTMLSpanElement>) => start(event, drag),
    onPointerMove: (event: PointerEvent<HTMLSpanElement>) => {
      const current = drag.current;
      if (current) current.preview.move(current.width + event.clientX - current.x);
    },
    onPointerUp: (event: PointerEvent<HTMLSpanElement>) => commit(event, drag, actions),
    onPointerCancel: () => cancel(drag),
    onLostPointerCapture: () => cancel(drag),
    onKeyDown: (event: KeyboardEvent<HTMLSpanElement>) => keyDown(event, actions),
  };
}
