import {
  auditAction,
  type AuditChange,
  statusText,
  postingText,
  scanSourceLabels,
  scanAttributionLabels,
} from '@wms/contracts';
import { auditObject } from './input-summary.ts';
import { businessText } from './projection.ts';
const fields: Record<string, { label: string; unit: string }> = {
  barcode: { label: '条码', unit: '' },
  productName: { label: '商品', unit: '' },
  source: { label: '录入方式', unit: '' },
  attribution: { label: '归属方式', unit: '' },
  scanClosedAt: { label: '扫码进度', unit: '' },
  status: { label: '状态', unit: '' },
  postingState: { label: '入账状态', unit: '' },
  packages: { label: '包数', unit: '包' },
  weightGrams: { label: '重量', unit: '吨' },
  plannedPackages: { label: '计划包数', unit: '包' },
  plannedWeightGrams: { label: '计划重量', unit: '吨' },
  actualPackages: { label: '实发包数', unit: '包' },
  actualWeightGrams: { label: '实发重量', unit: '吨' },
  name: { label: '名称', unit: '' },
  active: { label: '启用状态', unit: '' },
  vehicleNo: { label: '车牌', unit: '' },
  memo: { label: '备注', unit: '' },
  businessDate: { label: '业务日期', unit: '' },
  rowCount: { label: '条码数', unit: '条' },
  rows: { label: '导出条数', unit: '条' },
};
const stocktakeStates = new Map([
  ['counting', '盘点中'],
  ['completed', '已入账'],
  ['voided', '已作废'],
]);
export function parsedAuditObject(value: unknown) {
  if (typeof value !== 'string') return auditObject(value);
  try {
    return auditObject(JSON.parse(value));
  } catch {
    return {};
  }
}
function display(field: string, value: unknown, kind: string): string {
  if (field === 'scanClosedAt') return value == null ? '可扫码' : '已结束扫码';
  if (value == null) return '未记录';
  if (field === 'source') return scanSourceLabels[value as keyof typeof scanSourceLabels] ?? '未识别';
  if (field === 'attribution') return scanAttributionLabels[value as keyof typeof scanAttributionLabels] ?? '未识别';
  if (field === 'status' && kind === 'stocktake') return stocktakeStates.get(String(value)) ?? '未识别';
  if (field === 'status') return statusText(String(value), kind === 'inbound' ? 'inbound' : 'outbound');
  if (field === 'postingState')
    return Object.hasOwn(postingText, String(value)) ? postingText[value as keyof typeof postingText] : '未识别';
  if (field === 'active')
    return value === true || value === 1 ? '启用' : value === false || value === 0 ? '停用' : '未识别';
  if (typeof value === 'number' && Number.isFinite(value))
    return field.endsWith('WeightGrams') || field === 'weightGrams' ? (value / 1_000_000).toFixed(4) : String(value);
  return typeof value === 'string' ? businessText(value) : '未识别';
}
export function auditChanges(actionName: string, beforeValue: unknown, afterValue: unknown): AuditChange[] {
  const action = auditAction(actionName);
  const before = parsedAuditObject(beforeValue),
    after = parsedAuditObject(afterValue);
  return action.fields
    .filter(
      (key) =>
        fields[key] && (key in before || key in after) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .map((key) => ({
      field: key,
      ...fields[key]!,
      before: display(key, before[key], action.kind),
      after: display(key, after[key], action.kind),
    }));
}
export function auditSummary(changes: AuditChange[]): string | null {
  const summary = changes.map((change) => `${change.label} ${change.before}→${change.after}${change.unit}`).join('；');
  return summary ? summary.slice(0, 500) : null;
}
