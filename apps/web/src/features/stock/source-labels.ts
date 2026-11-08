import type { StockSource } from '@wms/contracts';

export const sourceLabels: Record<StockSource, string> = {
  'erp-product': 'ERP 历史商品',
  'sku-spec': 'SPEC 条码目录商品',
  unclassified: '未归属商品（仅明细）',
};
