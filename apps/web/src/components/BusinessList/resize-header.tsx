import { createContext, useContext, type ThHTMLAttributes } from 'react';
import { theme } from 'antd';
import { COLUMN_WIDTH, columnText } from './column-settings';
import { useColumnResize } from './use-column-resize';
import { useSortFeedback, type SortOrder } from './use-sort-feedback';

export const ResizeEnabled = createContext(false);
export interface ResizeHeaderProps extends ThHTMLAttributes<HTMLTableCellElement> {
  columnKey?: string;
  columnLabel?: string;
  columnWidth?: number;
  columnMinWidth?: number;
  resize?: (width: number) => void;
  resetWidth?: () => void;
  sort?: (order: SortOrder) => void;
}

export function ResizeHeader({
  columnKey,
  columnLabel,
  columnWidth,
  columnMinWidth,
  resize,
  resetWidth,
  sort,
  children,
  style,
  ...rest
}: ResizeHeaderProps) {
  const enabled = useContext(ResizeEnabled);
  const { token } = theme.useToken();
  const sortFeedback = useSortFeedback(rest, sort);
  const resizeEvents = useColumnResize({ resize, resetWidth });
  return (
    <th
      {...rest}
      {...sortFeedback}
      aria-label={columnLabel}
      style={{
        ...style,
        ['--list-sort-active' as string]: token.colorPrimary,
        ['--list-sort-inactive' as string]: token.colorTextQuaternary,
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
          aria-valuemin={columnMinWidth ?? COLUMN_WIDTH.min}
          aria-valuemax={COLUMN_WIDTH.max}
          aria-valuenow={columnWidth}
          tabIndex={0}
          title={columnText.handle}
          data-testid={`resize-${columnKey}`}
          className="business-list-resize-handle"
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
          {...resizeEvents}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => {
            event.stopPropagation();
            resetWidth?.();
          }}
        />
      )}
    </th>
  );
}
