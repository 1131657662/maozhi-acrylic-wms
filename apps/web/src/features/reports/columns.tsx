import type { ProColumns } from '@ant-design/pro-components';
import { listFields, listCellText, type ReportKind } from '@wms/contracts';
import { Link } from '@umijs/max';
import type { ListParams } from '../web-lists/keys';
import { rowDrilldown } from './drilldown';
import { reportInteractionCopy as copy } from './interaction-copy';

function fixedSide(kind: ReportKind, key: string, index: number): 'left' | 'right' | undefined {
  if (index === 0) return 'left';
  const measures = kind === 'report-details' ? ['packages', 'weightGrams'] : ['inboundGrams', 'outboundGrams'];
  return key === 'checkState' || measures.includes(key) ? 'right' : undefined;
}
export function reportColumns<Row>(kind: ReportKind, params: ListParams = {}): ProColumns<Row>[] {
  return listFields[kind].map((f, i) => ({
    title: f.label,
    dataIndex: f.key,
    key: f.key,
    width:
      (
        {
          period: 104,
          warehouseName: 112,
          productName: 184,
          checkState: 96,
          postedAt: 176,
          id: 80,
          packages: 80,
          weightGrams: 112,
          inboundGrams: 112,
          outboundGrams: 112,
        } as Record<string, number>
      )[f.key] ?? Math.min(288, Math.max(112, f.width * 6)),
    fixed: fixedSide(kind, f.key, i),
    hideInSetting: i === 0,
    sorter: ['postedAt', 'period', 'productCode', 'warehouseCode'].includes(f.key),
    align: f.type === 'integer' || f.type === 'tonnes' ? 'right' : undefined,
    render: (_, row) => {
      const record = row as Record<string, unknown>,
        text = listCellText(kind, f, record);
      const drillColumn = kind === 'report-details' ? 'orderNo' : kind === 'report-monthly' ? 'period' : 'productName';
      if (f.key === drillColumn) {
        const href = rowDrilldown(kind, params, record);
        if (href) return <Link to={href}>{text}</Link>;
        if (kind === 'report-aging')
          return (
            <span aria-disabled="true" title={copy.historicalStock}>
              {text}
            </span>
          );
      }
      return text;
    },
  }));
}
