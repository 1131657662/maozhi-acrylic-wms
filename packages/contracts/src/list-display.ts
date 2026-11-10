import { snapshotText } from './snapshots.ts';
import type { ExportKind } from './export-kind.ts';
import { reportFields } from './report-fields.ts';

const states = new Map([
  ['open', { text: '待扫码', color: 'processing' }],
  ['frozen', { text: '待出库确认', color: 'warning' }],
  ['confirmed', { text: '已出库', color: 'success' }],
  ['audited', { text: '已审核', color: 'default' }],
  ['cancelled', { text: '已撤销确认', color: 'default' }],
  ['voided', { text: '已作废（未入账）', color: 'default' }],
]);
export function knownStatus(status: string | null, kind: 'inbound' | 'outbound') {
  if (kind === 'inbound' && status === 'pending') return { text: '待入库确认', color: 'warning' };
  return status === null ? undefined : states.get(status);
}
export function statusText(status: string | null, kind: 'inbound' | 'outbound'): string {
  const known = knownStatus(status, kind);
  if (known) return kind === 'inbound' && status === 'confirmed' ? '已入库' : known.text;
  return `状态待识别：${status === '' ? '空值' : (status ?? '未记录')}`;
}
export const postingText = {
  legacy: '历史记录',
  pending: '待确认入账',
  confirmed: '已确认入账',
  reversed: '已反向补偿',
  voided: '已作废（未入账）',
};
const formatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
export function listTime(iso: string): string {
  return formatter.format(new Date(iso));
}
export interface ListField {
  key: string;
  label: string;
  width: number;
  type: 'text' | 'integer' | 'tonnes' | 'date';
  total?: false;
  defaultHidden?: boolean;
}
const f = (key: string, label: string, type: ListField['type'] = 'text', width = 24): ListField => ({
  key,
  label,
  type,
  width,
});
export const listFields: Record<ExportKind, ListField[]> = {
  ...reportFields,
  inbound: [
    f('receiptNo', '入库单号'),
    f('packages', '包数', 'integer', 12),
    f('weightGrams', '总重量（吨）', 'tonnes', 18),
    f('status', '原始状态', 'text', 30),
    f('postingState', '入账状态'),
    f('products', '商品明细', 'text', 48),
    { ...f('productModels', '商品型号'), defaultHidden: true },
    f('supplierName', '供应商'),
    ...[f('deliveryName', '送货人'), f('deliveryPhone', '送货电话'), f('deliveryAddress', '送货地址')].map((field) => ({
      ...field,
      defaultHidden: true,
    })),
    f('warehouseName', '仓库'),
    f('createdAt', '登记时间', 'date', 24),
  ],
  outbound: [
    f('orderNo', '出库单号'),
    ...[f('products', '商品明细'), f('productModels', '商品型号')].map((field) => ({ ...field, defaultHidden: true })),
    f('plannedPackages', '计划包数', 'integer', 14),
    f('plannedWeightGrams', '计划重量（吨）', 'tonnes', 20),
    f('actualPackages', '实扫包数', 'integer', 14),
    f('actualWeightGrams', '实扫重量（吨）', 'tonnes', 20),
    f('status', '状态', 'text', 30),
    f('customerName', '客户'),
    ...[f('shipToName', '收货人'), f('shipToPhone', '收货电话'), f('shipToAddress', '收货地址')].map((field) => ({
      ...field,
      defaultHidden: true,
    })),
    f('warehouseName', '仓库'),
    f('vehicleNo', '车牌'),
    f('createdAt', '建单时间', 'date', 24),
  ],
  stock: [
    f('productName', '商品名称', 'text', 48),
    f('packages', '库存包数', 'integer', 14),
    f('weightGrams', '库存重量（吨）', 'tonnes', 20),
    f('productCode', '商品编码'),
    f('warehouseCode', '仓库', 'text', 32),
  ],
  audit: [
    f('action', '动作'),
    f('targetId', '对象', 'text', 40),
    f('actor', '操作者'),
    f('createdAt', '时间', 'date', 24),
    f('traceId', '请求编号', 'text', 42),
  ],
};
export function listCellText(kind: ExportKind, field: ListField, row: Record<string, unknown>): string {
  const value = row[field.key];
  if (field.key === 'status' && !kind.startsWith('report-'))
    return statusText(value == null ? null : String(value), kind === 'inbound' ? 'inbound' : 'outbound');
  if (
    ['inbound', 'outbound'].includes(kind) &&
    [
      'supplierName',
      'customerName',
      'warehouseName',
      'shipToName',
      'shipToPhone',
      'shipToAddress',
      'deliveryName',
      'deliveryPhone',
      'deliveryAddress',
    ].includes(field.key)
  )
    return snapshotText(value == null ? null : String(value));
  if (value == null || value === '') return '-';
  if (field.key === 'reasons') return Array.isArray(value) ? value.join('；') || '-' : String(value);
  if (field.key === 'postingState') return postingText[value as keyof typeof postingText] ?? String(value);
  if (['products', 'productModels'].includes(field.key))
    return Array.isArray(value) ? value.join('；') || '无有效明细' : '';
  if (kind === 'stock' && field.key === 'warehouseCode') return `${row.warehouseName}（${value}）`;
  if (field.type === 'date') return listTime(String(value));
  if (field.type === 'tonnes') return (Number(value) / 1_000_000).toFixed(4);
  return value == null || value === '' ? '-' : String(value);
}
