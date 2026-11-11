import { tonnes } from '@wms/contracts';
export const actualText = {
  deduction: (packages: number, grams: number) => `本单将扣减：${packages} 包 / ${tonnes(grams)} 吨`,
  planDifference: (
    name: string,
    plannedPackages: number,
    plannedGrams: number,
    actualPackages: number,
    actualGrams: number,
  ) =>
    `${name}：计划 ${plannedPackages} 包 / ${tonnes(plannedGrams)} 吨 → 实发 ${actualPackages} 包 / ${tonnes(actualGrams)} 吨`,
  title: '出库明细',
  product: '商品',
  planned: '计划包数 / 吨数',
  scanned: '扫码包数 / 吨数',
  packages: '实发包数',
  tonnes: '实发吨数',
  difference: '与计划差异',
  notScanned: '未扫码',
  prefill: '按扫码预填',
  review: '按扫码预填，请核对；输入的实发量才会扣减库存。',
  required: '请填写本行实发数量，可填 0',
  titleConfirm: '确认实际出库',
  confirm: '确认出库',
  ask: '核对并确认出库',
  cancel: '返回核对',
  done: '已确认出库',
  notice: '请核对实发量；确认后按实发扣减库存。',
  allZero: '本次没有发货数量',
  scanTitle: '扫码清单',
  export: '导出扫码清单',
  barcode: '条码',
  scanWeight: '重量（吨）',
  scanTime: '扫码时间',
  unknown: '未记录',
  scanTotal: '扫码合计',
};
export const ACTUAL_TABLE_WIDTH = 1130;
export const SCAN_TABLE_WIDTH = 850;
export const SCAN_PAGE_SIZE = 20;
