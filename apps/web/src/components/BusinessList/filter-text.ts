import { knownStatus, postingText, statusText } from '@wms/contracts';

export const FILTER_DRAWER_WIDTH = 480;
export const filterText = {
  title: '高级筛选',
  trigger: '筛选',
  query: '查询',
  reset: '重置',
  groups: { document: '单据', product: '商品', party: '往来', other: '其他' },
  fields: {
    keyword: '单号',
    supplier: '供应商',
    customer: '客户',
    warehouse: '仓库',
    vehicle: '车牌',
    productCodes: '商品编码',
    productMode: '匹配方式',
    status: '状态',
    statusMissing: '状态',
    postingState: '入账状态',
    product: '商品',
    from: '开始日期',
    to: '结束日期',
  } as Record<string, string>,
  mode: { any: '任一商品', all: '全部商品' } as Record<string, string>,
};

export function filterValue(key: string, value: string, kind: 'inbound' | 'outbound'): string {
  if (key === 'productMode') return filterText.mode[value] ?? '待识别';
  if (key === 'postingState') return postingText[value as keyof typeof postingText] ?? '待识别';
  if (key === 'statusMissing') return '未记录';
  if (key === 'status') return knownStatus(value, kind) ? statusText(value, kind) : '待识别';
  if (key === 'from' || key === 'to') return value.slice(0, 10);
  return value;
}
