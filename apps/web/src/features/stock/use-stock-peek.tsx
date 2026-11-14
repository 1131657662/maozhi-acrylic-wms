import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { stockPairKey, type WebStockRow } from '@wms/contracts';
import type { TableProps } from 'antd';
import { movementKeys } from './movement-keys';
import { movementCopy as copy } from './movement-copy';
import { PeekContent } from './peek-content';
import { COLUMN_WIDTH } from '../../components/BusinessList/column-settings';

export function useStockPeek(props: {
  rows: WebStockRow[];
  scope: string;
  disabled: boolean;
  open: (row: WebStockRow) => void;
}) {
  const [expanded, setExpanded] = useState<{ scope: string; id: string | null }>();
  if (expanded && expanded.scope !== props.scope) setExpanded(undefined);
  const active = expanded?.scope === props.scope;
  const peek = useQuery({
    ...movementKeys.peek(
      props.rows.map(({ warehouseCode, productCode }) => ({ warehouseCode, productCode })),
      props.scope,
    ),
    enabled: active && !props.disabled && props.rows.length > 0,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const expandable: TableProps<WebStockRow>['expandable'] = {
    fixed: 'left',
    columnWidth: COLUMN_WIDTH.selection,
    expandedRowKeys: active && expanded?.id ? [expanded.id] : [],
    onExpand: (open, row) => setExpanded({ scope: props.scope, id: open ? row.id : null }),
    expandIcon: ({ expanded: isOpen, onExpand, record }) => (
      <Button
        type="text"
        size="small"
        aria-label={isOpen ? copy.collapse : copy.expand}
        aria-expanded={isOpen}
        disabled={props.disabled}
        icon={isOpen ? <DownOutlined /> : <RightOutlined />}
        onClick={(event) => {
          event.stopPropagation();
          onExpand(record, event);
        }}
      />
    ),
    expandedRowRender: (row) => (
      <PeekContent
        rows={peek.data?.find((group) => stockPairKey(group) === stockPairKey(row))?.items}
        error={peek.error}
        retry={peek.refetch}
        open={() => props.open(row)}
      />
    ),
  };
  return expandable;
}
