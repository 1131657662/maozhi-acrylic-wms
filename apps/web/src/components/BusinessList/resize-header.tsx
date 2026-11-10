import { createContext, useContext, useEffect, useRef, type ThHTMLAttributes, type PointerEvent } from 'react';
import { theme } from 'antd';
import { COLUMN_WIDTH, columnText } from './column-settings';

export const ResizeEnabled = createContext(false);
export interface ResizeHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  columnKey?: string;
  columnLabel?: string;
  columnWidth?: number;
  resize?: (width: number) => void;
  resetWidth?: () => void;
}

function lockScroll(element: HTMLElement): () => void {
  const root = element.closest('[data-table-resize-root]');
  const scrollers = Array.from(
    root?.querySelectorAll<HTMLElement>('.ant-table-body,.ant-table-content,.ant-table-header') ?? [],
  );
  const releases = scrollers.map((node) => {
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

export function ResizeHeader({
  columnKey,
  columnLabel,
  columnWidth,
  resize,
  resetWidth,
  children,
  style,
  ...rest
}: ResizeHeaderProps) {
  const enabled = useContext(ResizeEnabled);
  const { token } = theme.useToken();
  const drag = useRef<{ x: number; width: number; release: () => void } | null>(null);
  const finish = () => {
    drag.current?.release();
    drag.current = null;
  };
  useEffect(() => finish, []);
  const down = (event: PointerEvent<HTMLSpanElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    finish();
    drag.current = { x: event.clientX, width: columnWidth!, release: lockScroll(event.currentTarget) };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  return (
    <th
      {...rest}
      aria-label={columnLabel}
      style={{
        ...style,
        position: style?.insetInlineStart !== undefined || style?.insetInlineEnd !== undefined ? 'sticky' : 'relative',
      }}
      data-column-key={columnKey}
    >
      {children}
      {enabled && resize && (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`${columnText.resize}：${columnLabel ?? columnText.resize}`}
          aria-valuemin={COLUMN_WIDTH.min}
          aria-valuemax={COLUMN_WIDTH.max}
          aria-valuenow={columnWidth}
          tabIndex={0}
          title={columnText.handle}
          data-testid={`resize-${columnKey}`}
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: COLUMN_WIDTH.handle,
            cursor: 'col-resize',
            touchAction: 'none',
            zIndex: 1,
            borderRight: `1px solid ${token.colorBorderSecondary}`,
          }}
          onPointerDown={down}
          onPointerMove={(event) => {
            if (drag.current) resize(drag.current.width + event.clientX - drag.current.x);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            finish();
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={finish}
          onLostPointerCapture={finish}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation();
            resetWidth?.();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Home') {
              event.preventDefault();
              resetWidth?.();
            }
            if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
              event.preventDefault();
              resize(
                columnWidth! + (event.key === 'ArrowRight' ? COLUMN_WIDTH.keyboardStep : -COLUMN_WIDTH.keyboardStep),
              );
            }
          }}
        />
      )}
    </th>
  );
}
