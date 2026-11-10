export const businessLabels = {
  unknown: '未识别',
  empty: '—',
  catalogSource: '条码目录',
  relatedRecord: '相关业务记录',
  reportDates: '按入账日期统计',
  reportExplanation: '按确认入账时间归属所选期间；撤销计入撤销发生日，历史业务日期不改变入账月份。',
};
const actions: Record<string, string> = {
  'inbound.create': '登记入库',
  'inbound.confirm': '确认入库',
  'inbound.reverse': '撤销入库',
  'inbound.void': '作废入库单',
  'outbound.plan.create': '新建出库计划',
  'outbound.plan.update': '修改出库计划',
  'outbound.confirm': '确认出库',
  'outbound.reverse': '撤销出库',
  'outbound.void': '作废出库单',
  'stock.adjust': '调整库存',
  'stock.correct': '更正数量',
  'master.create': '新增基础资料',
  'master.update': '修改基础资料',
  'contact.create': '新增联系人',
  'contact.update': '修改联系人',
  'contact.default': '设置默认联系人',
  'contact.delete': '删除联系人',
  'vehicle.create': '新增车辆',
  'vehicle.auto-create': '登记车辆',
  'vehicle.update': '修改车辆',
  'catalog.upload': '上传条码目录',
  'catalog.publish': '发布条码目录',
  'catalog.handoff.register': '登记条码交接',
  'catalog.handoff.link': '关联条码交接',
  'catalog.handoff.bind': '关联扫码记录',
  'catalog.handoff.confirm': '确认条码交接',
  'stocktake.create': '开始盘点',
  'stocktake.reading': '保存实盘数量',
  'stocktake.post': '盘点入账',
  'stocktake.void': '作废盘点',
  'stocktake.snapshot-basis.acknowledge': '核对盘点期间收发货',
};
export function auditActionText(value: unknown) {
  return typeof value === 'string' ? (actions[value] ?? businessLabels.unknown) : businessLabels.empty;
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
