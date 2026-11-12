import { snapshotText } from './snapshots.ts';
import type { ExportKind } from './export-kind.ts';
import { reportFields } from './report-fields.ts';
import { businessLabels } from './business-labels.ts';
import { billTypeText, documentExtraCopy } from './document-types.ts';

export const WEB_LIST_PAGE_SIZES = [20, 50, 100, 200] as const;
export const WEB_LIST_DEFAULT_PAGE_SIZE = 50;
export const WEB_LIST_VIEW_SCHEMA_VERSION = 1;

const states = new Map([
  ['open', { text: '待扫码', color: 'processing' }],
  ['frozen', { text: '已扫码，待确认', color: 'warning' }],
  ['confirmed', { text: '已出库', color: 'success' }],
  ['partially_shipped', { text: '部分发货', color: 'processing' }],
  ['short_closed', { text: '已短关', color: 'default' }],
  ['audited', { text: '历史单据', color: 'default' }],
  ['submit', { text: '历史单据', color: 'default' }],
  ['cancelled', { text: '已撤销', color: 'default' }],
  ['voided', { text: '已作废（未入账）', color: 'default' }],
]);
export function knownStatus(status: string | null, kind: 'inbound' | 'outbound') {
  if (kind === 'inbound' && status === 'pending') return { text: '待入库确认', color: 'warning' };
  return status === null ? undefined : states.get(status);
}
export function statusText(status: string | null, kind: 'inbound' | 'outbound'): string {
  const known = knownStatus(status, kind);
  if (known) return kind === 'inbound' && status === 'confirmed' ? '已入账' : known.text;
  return status === null || status === '' ? '—' : '未识别';
}
export const postingText = {
  legacy: '历史记录',
  pending: '待确认入账',
  confirmed: '已确认入账',
  reversed: '已撤销',
  voided: '已作废（未入账）',
};
const formatter = new Intl.DateTimeFormat('sv-SE', {
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
    f('effectiveBusinessDate', '业务日期'),
    f('billType', documentExtraCopy.billType),
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
    f('effectiveBusinessDate', '业务日期'),
    f('billType', documentExtraCopy.billType),
    ...[f('products', '商品明细'), f('productModels', '商品型号')].map((field) => ({ ...field, defaultHidden: true })),
    f('plannedPackages', '计划包数', 'integer', 14),
    f('plannedWeightGrams', '计划重量（吨）', 'tonnes', 20),
    f('actualPackages', '实发包数', 'integer', 14),
    f('actualWeightGrams', '实发重量（吨）', 'tonnes', 20),
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
    f('createdAt', '时间', 'date', 24),
    f('action', '类型'),
    f('objectLabel', '对象', 'text', 40),
    f('summary', '变更摘要', 'text', 60),
    f('channel', '渠道'),
    f('result', '结果'),
    { ...f('actor', '操作人'), defaultHidden: true },
  ],
};
export function matchedLineFields(kind: 'inbound' | 'outbound'): ListField[] {
  return [
    f(kind === 'inbound' ? 'receiptNo' : 'orderNo', kind === 'inbound' ? '入库单号' : '出库单号', 'text', 24),
    f('productCode', '商品编码', 'text', 24),
    f('productName', '商品名称', 'text', 32),
    f('packages', '包数', 'integer', 12),
    f('weightGrams', '重量（吨）', 'tonnes', 18),
  ];
}
export function listCellText(kind: ExportKind, field: ListField, row: Record<string, unknown>): string {
  const value = row[field.key];
  if (kind.startsWith('report-') && field.key === 'source')
    return ['erp-product', 'inventory-eligible'].includes(String(value)) ? '库存商品' : businessLabels.unknown;
  if (kind.startsWith('report-') && field.key === 'billType')
    return value && /^[\p{Script=Han}]+$/u.test(String(value)) ? String(value) : businessLabels.unknown;
  if (field.key === 'status' && !kind.startsWith('report-'))
    return statusText(value == null ? null : String(value), kind === 'inbound' ? 'inbound' : 'outbound');
  if (field.key === 'billType' && (kind === 'inbound' || kind === 'outbound'))
    return billTypeText(kind, value == null ? null : String(value));
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
  if (field.key === 'postingState') return postingText[value as keyof typeof postingText] ?? '未识别';
  if (['products', 'productModels'].includes(field.key))
    return Array.isArray(value) ? value.join('；') || '无有效明细' : '';
  if (kind === 'stock' && field.key === 'warehouseCode') return `${row.warehouseName}（${value}）`;
  if (field.type === 'date') return listTime(String(value));
  if (field.type === 'tonnes') return (Number(value) / 1_000_000).toFixed(4);
  return value == null || value === '' ? '-' : String(value);
}
