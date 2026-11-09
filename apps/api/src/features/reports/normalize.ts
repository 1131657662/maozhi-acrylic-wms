import type { Row } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { statusText } from '@wms/contracts';
import type { LedgerEvent } from './types.ts';
import { objectJson, localIso, nullableInt, optionalGrams } from './source-values.ts';
export { objectJson, localIso } from './source-values.ts';

function classification(type: string): Pick<LedgerEvent, 'family' | 'reverse' | 'operationLabel' | 'directionLabel'> {
  const labels = new Map<string, [LedgerEvent['family'], string]>([
    ['inbound', ['inbound', '历史入库']],
    ['outbound', ['outbound', '历史出库']],
    ['check', ['count', '历史盘点']],
    ['import', ['import', '历史导入']],
    ['inbound.confirm', ['inbound', '入库确认']],
    ['inbound.reverse', ['inbound', '入库撤销']],
    ['outbound.confirm', ['outbound', '出库确认']],
    ['outbound.reverse', ['outbound', '出库撤销']],
    ['stock.adjust', ['manual', '人工调整']],
    ['stock.correct', ['correction', '数量更正']],
    ['stocktake.post', ['count', '盘点回写']],
  ]);
  const [family, operationLabel] = labels.get(type) ?? ['unknown', `未分类：${type || '未记录'}`];
  return {
    family,
    reverse: type.endsWith('.reverse'),
    operationLabel,
    directionLabel: family === 'inbound' ? '入库' : family === 'outbound' ? '出库' : '调整',
  };
}
function quantities(row: Row, source: Record<string, unknown>, cls: ReturnType<typeof classification>) {
  const historical = row.source_id != null,
    deltaPackages = Number(row.packages_delta),
    deltaGrams = decimalToGrams(row.tonnes_delta),
    correctionOffsetPackages = Number(row.correctionOffsetPackages ?? 0),
    correctionOffsetGrams = decimalToGrams(row.correctionOffsetTonnes ?? '0');
  return {
    packages: (cls.family === 'outbound' ? -1 : 1) * (deltaPackages - correctionOffsetPackages),
    weightGrams: (cls.family === 'outbound' ? -1 : 1) * (deltaGrams - correctionOffsetGrams),
    correctionOffsetPackages,
    correctionOffsetGrams,
    deltaPackages,
    deltaGrams,
    beforePackages: nullableInt(historical ? source.before_qty : row.packages_before),
    afterPackages: nullableInt(historical ? source.after_qty : row.packages_after),
    beforeGrams: optionalGrams(historical ? source.before_weight : row.tonnes_before),
    afterGrams: optionalGrams(historical ? source.after_weight : row.tonnes_after),
  };
}
function documentFields(row: Row, source: Record<string, unknown>, cls: ReturnType<typeof classification>) {
  const document = objectJson(row.documentSource),
    historical = row.source_id != null;
  return {
    businessDate: String(row.documentBusinessDate ?? document.inbound_date ?? document.outbound_date ?? '') || null,
    createdAt: historical
      ? localIso(document.create_time)
      : row.documentCreated
        ? new Date(String(row.documentCreated).replace(' ', 'T') + 'Z').toISOString()
        : null,
    confirmedAt: historical ? localIso(document.audit_time) : localIso(row.reportLocalTime),
    orderNo: String(row.orderNo ?? ''),
    documentId: row.documentId == null ? null : String(row.documentId),
    partner: String(document.customer_name ?? row.partner ?? document.supplier_code ?? ''),
    vehicleNo: String(document.vehicle_no ?? row.vehicleNo ?? ''),
    containerNo: String(document.container_no ?? ''),
    billType: String(document.bill_type_code ?? ''),
    referenceNo: String(document.delivery_no ?? document.contract_no ?? ''),
    status: statusText(
      row.documentStatus == null ? null : String(row.documentStatus),
      cls.family === 'inbound' ? 'inbound' : 'outbound',
    ),
    actor: String(row.actor ?? source.create_by ?? row.documentActor ?? ''),
    reason: String(row.reason ?? source.remark ?? row.memo ?? ''),
  };
}
function identityFields(row: Row, source: Record<string, unknown>) {
  return {
    warehouseCode: String(row.warehouseCode),
    warehouseName: String(source.warehouse_name ?? row.warehouseName ?? row.warehouseCode),
    productCode: String(row.productCode),
    productName: String(source.product_name ?? row.productName),
    productModel: String(source.product_model ?? row.productModel ?? ''),
    nameBasis: `${source.product_name ? '商品：原流水快照' : '商品：当前主数据'}；${source.warehouse_name ? '仓库：原流水快照' : '仓库：当前主数据'}`,
    operationId: row.operation_id == null ? null : String(row.operation_id),
    originalOperationId: row.originalOperationId == null ? null : String(row.originalOperationId),
  };
}
export function normalizeEvent(row: Row): LedgerEvent {
  const source = objectJson(row.source_row_json),
    type = String(row.operation_type ?? row.source_business_type ?? ''),
    cls = classification(type);
  const localTime = localIso(row.reportLocalTime)
    ? String(row.reportLocalTime).slice(0, 19) +
      '.' +
      (String(row.reportLocalTime).split('.')[1] ?? '').padEnd(6, '0').slice(0, 6)
    : null;
  return {
    ...cls,
    ...identityFields(row, source),
    ...quantities(row, source, cls),
    ...documentFields(row, source, cls),
    sequence: Number(row.id),
    id: String(row.id),
    localTime,
    historical: row.source_id != null,
    deleted: row.source_del_flag === 1,
    postedAt: localIso(row.reportLocalTime),
    operationType: type,
    timeStatus: row.source_id != null ? '时间未核实' : 'UTC → 上海时间',
    checkState: '待核对',
  };
}
