import {
  CATALOG_SEARCH_DEFAULT_PAGE_SIZE,
  CATALOG_SEARCH_MAX_QUERY_LENGTH,
  CATALOG_SEARCH_PAGE_SIZE_OPTIONS,
} from '@wms/contracts';

export const CATALOG_QUERY_PAGE_SIZE_OPTIONS = CATALOG_SEARCH_PAGE_SIZE_OPTIONS;
export const CATALOG_QUERY_DEFAULT_PAGE_SIZE = CATALOG_SEARCH_DEFAULT_PAGE_SIZE;
export const CATALOG_QUERY_MAX_LENGTH = CATALOG_SEARCH_MAX_QUERY_LENGTH;
export const CATALOG_TRACE_DRAWER_SIZE = 'min(720px,100%)';

export const catalogQueryCopy = {
  searchTitle: '目录搜索',
  searchLabel: '搜索条码或规格',
  searchPlaceholder: '输入条码或规格',
  barcode: '条码',
  spec: '规格',
  version: '版本',
  status: '状态',
  weight: '重量',
  searchEmpty: '没有匹配的条码',
  currentVersion: (versionId: number) => `当前目录 · 第 ${versionId} 版`,
  retrySearch: '重试目录搜索',
  summaryTitle: '规格分组',
  barcodeCount: '条码数',
  totalWeight: '总重量',
  minWeight: '最小重量',
  maxWeight: '最大重量',
  averageWeight: '平均重量',
  summaryEmpty: '当前目录暂无规格数据',
  retrySummary: '重试规格汇总',
  traceTitle: '条码版本轨迹',
  traceAction: '查看版本轨迹',
  traceEmpty: '该条码尚未出现在可查询版本中',
  firstVersion: '首次出现',
  lastVersion: '最近出现',
  createdAt: '上传时间',
  publishedAt: '发布时间',
  published: '已发布',
  validated: '待发布',
  retryTrace: '重试版本轨迹',
  lookupTitle: '扫描测试',
  lookupLabel: '扫描测试条码',
  lookupPlaceholder: '输入或扫描条码',
  lookupFound: '当前目录有效',
  lookupNotFound: '当前目录未找到该条码',
  retryLookup: '重试条码查询',
  noSpec: '未填写规格',
  kilogram: '千克',
  total: (count: number) => `共 ${count} 条`,
};
