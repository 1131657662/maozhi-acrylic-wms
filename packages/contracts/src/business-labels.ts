import { auditAction } from './audit-registry.ts';
export const businessLabels = {
  unknown: '未识别',
  empty: '—',
  catalogSource: '条码目录',
  relatedRecord: '相关业务记录',
  reportDates: '按入账日期统计',
  reportExplanation: '按入账日统计有效收发量，已包含数量更正与撤销；跨月更正计入更正发生月，调整只含盘点与期初调整。',
};
export function auditActionText(value: unknown) {
  return typeof value === 'string' ? auditAction(value).label : businessLabels.empty;
}
export function businessErrorText(text: string): string {
  if (/幂等/.test(text)) return '此次操作内容已变化，请重新打开后提交';
  return text
    .replace(/主数据/g, '基础资料')
    .replace(/校验/g, '检查')
    .replace(/字段|参数|枚举/g, '填写内容')
    .replace(/接口/g, '服务')
    .replace(/事务/g, '处理')
    .replace(/回滚/g, '未保存')
    .replace(/落库/g, '保存')
    .replace(/口径/g, '统计方式')
    .replace(/快照/g, '当时记录')
    .replace(/占位|待接入|硬编码/g, '暂不可用');
}
