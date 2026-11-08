import { createQueryKeys } from '@lukemorales/query-key-factory';
import { sourceStockSchema, sourceJournalSchema, type StockSource } from '@wms/contracts';
import { request } from '../../api/client';

export const stockKeys = createQueryKeys('stock-source', {
  view: (source: StockSource) => ({
    queryKey: [source],
    queryFn: async () => {
      const result = await request(`/stock/by-source?source=${source}`, sourceStockSchema);
      if (result.source !== source) throw new Error('库存来源不匹配，已停止展示，请重试');
      return result;
    },
  }),
  journal: (source: StockSource) => ({
    queryKey: [source],
    queryFn: async () => {
      const result = await request(`/stock/by-source/journal?source=${source}&limit=20`, sourceJournalSchema);
      if (result.source !== source) throw new Error('流水来源不匹配，已停止展示，请重试');
      return result.items;
    },
  }),
});
