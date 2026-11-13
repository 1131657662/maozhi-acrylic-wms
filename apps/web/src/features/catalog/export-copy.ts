import { catalogExportCopy, CATALOG_DIFF_PAGE_SIZE } from '@wms/contracts';

export const catalogReadCopy = {
  ...catalogExportCopy,
  export: '导出当前视图',
  exportFile: '条码目录.xlsx',
  downloadErrors: '下载错误清单',
  errorsFile: '条码目录错误清单.csv',
  errorCount: (count: number) => `发现 ${count} 条错误，整版未导入`,
  compareTitle: '目录版本对比',
  chooseBase: '设为对比基准',
  chooseBaseLabel: (id: number) => `将第 ${id} 版设为对比基准`,
  compareWith: (id: number) => `与第 ${id} 版对比`,
  comparisonBase: (id: number) => `对比基准：第 ${id} 版`,
  compareHint: '先选一个基准版本，再选择另一版对比；可翻页选择历史版本。',
  comparison: (base: number | null, id: number) =>
    base === null ? `初始空目录 → 第 ${id} 版` : `第 ${base} → ${id} 版差异`,
  allDiff: '全部差异与条目',
  added: '新增',
  removed: '消失',
  weightChanged: '重量变更',
  specChanged: '规格变更',
  unchanged: '未变化',
  change: '变化',
  specChange: '原规格 → 新规格',
  weightChange: '原重量 → 新重量',
  retryDiff: '重试差异查询',
  diffKind: '差异类型',
  noDiff: '该类没有差异条目',
  previous: '上一页',
  next: '下一页',
  diffCount: (count?: number) => `共 ${count ?? '…'} 条 · 每页最多 ${CATALOG_DIFF_PAGE_SIZE} 条`,
};
export const CATALOG_COMPARE_DRAWER_SIZE = 'min(1040px,100%)';
