import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { InboxOutlined } from '@ant-design/icons';
import { ProFormText } from '@ant-design/pro-components';
import type { WebStockRow } from '@wms/contracts';
import { BusinessList } from '../../components/BusinessList';
import { ListFilters, WarehouseFilter } from '../../components/BusinessList/filters';
import { EmptyState, StatusTag, Toolbar } from '../../components/ui';
import { useListState, type ListState } from '../../components/BusinessList/use-list-state';
import { businessCopy } from '../../business-copy';
import { webListKeys } from '../web-lists/keys';
import { AdjustmentDrawer } from './adjustment-drawer';
import { StockJournal } from './journal';
import { stockListColumns } from './list-columns';
import { StockListSubtotal } from './list-subtotal';
import { stockPageCopy } from './stock-copy';
import { stockTableSummary } from './table-summary';
import { useStockPeek } from './use-stock-peek';
import { MovementDrawer } from './movement-drawer';
import { useLocation } from '@umijs/max';

export function StockWorkspace() {
  const location = useLocation();
  const state = useListState('warehouseCode', { scope: 'inventory' }, {}, ['source']);
  const stockListQuery = useQuery({ ...webListKeys.stock(state.params), placeholderData: keepPreviousData });
  const [selected, setSelected] = useState<WebStockRow | null>(null);
  const [journalRow, setJournalRow] = useState<WebStockRow | null>(null);
  const scope = JSON.stringify({
    params: state.params,
    watermark: stockListQuery.data?.watermark,
    refreshedAt: stockListQuery.dataUpdatedAt,
    rows: stockListQuery.data?.items.map((row) => row.id),
  });
  const expandable = useStockPeek({
    rows: stockListQuery.data?.items ?? [],
    scope,
    disabled: stockListQuery.isPlaceholderData ?? false,
    open: setJournalRow,
  });
  return (
    <>
      <BusinessList
        state={state}
        query={stockListQuery}
        config={stockListConfig(setSelected)}
        filters={<StockFilters state={state} />}
        summary={<StockListSubtotal subtotal={stockListQuery.data?.subtotal} />}
        tableSummary={stockTableSummary}
        expandable={expandable}
      >
        <StockJournal />
      </BusinessList>
      {selected && <AdjustmentDrawer row={selected} onClose={() => setSelected(null)} />}
      {journalRow && (
        <MovementDrawer
          row={journalRow}
          scope={scope}
          returnTo={location.pathname + location.search}
          open
          close={() => setJournalRow(null)}
        />
      )}
    </>
  );
}

function StockFilters({ state }: { state: ListState }) {
  return (
    <ListFilters state={state}>
      <ProFormText name="product" label="商品" placeholder="商品名称或编码" />
      <WarehouseFilter />
    </ListFilters>
  );
}

function stockListConfig(onAdjust: (row: WebStockRow) => void) {
  return {
    name: 'stock' as const,
    title: stockPageCopy.title,
    icon: <InboxOutlined />,
    description: stockPageCopy.description,
    columns: stockListColumns(onAdjust),
    emptyText: <EmptyState description={stockPageCopy.emptyList} />,
    extra: (
      <Toolbar>
        <span data-testid="stock-source-label">
          <StatusTag status={businessCopy.outboundStock1} />
        </span>
      </Toolbar>
    ),
    designShell: true,
    designViewToolbar: true,
    resultCardTitle: stockPageCopy.listSection,
  };
}
