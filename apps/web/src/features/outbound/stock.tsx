import { businessCopy } from '../../business-copy';
import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ProFormText } from '@ant-design/pro-components';
import { Tag } from 'antd';
import type { WebStockRow } from '@wms/contracts';
import { BusinessList } from '../../components/BusinessList';
import { ListFilters, WarehouseFilter } from '../../components/BusinessList/filters';
import { useListState } from '../../components/BusinessList/use-list-state';
import { webListKeys } from '../web-lists/keys';
import { stockListColumns } from '../stock/list-columns';
import { StockListSubtotal } from '../stock/list-subtotal';
import { StockJournal } from '../stock/journal';
import { AdjustmentDrawer } from '../stock/adjustment-drawer';

export function Stock() {
  const state = useListState('warehouseCode', { scope: 'inventory' }, {}, ['source']);
  const query = useQuery({ ...webListKeys.stock(state.params), placeholderData: keepPreviousData });
  const [selected, setSelected] = useState<WebStockRow | null>(null);
  return (
    <>
      <BusinessList
        state={state}
        query={query}
        config={{
          name: 'stock',
          title: '库存概览',
          columns: stockListColumns(setSelected),
          description: '库存与单据使用有库存资格的商品；扫码目录只用于现场核对，不计入库存。包数与重量独立记录。',
          extra: <Tag data-testid="stock-source-label">{businessCopy.outboundStock1}</Tag>,
        }}
        filters={
          <ListFilters state={state}>
            <ProFormText name="product" label="商品" placeholder="商品名称或编码" />
            <WarehouseFilter />
          </ListFilters>
        }
        summary={<StockListSubtotal subtotal={query.data?.subtotal} />}
      >
        <StockJournal />
      </BusinessList>
      {selected && <AdjustmentDrawer row={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
