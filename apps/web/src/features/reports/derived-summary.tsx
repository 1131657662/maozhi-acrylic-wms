import { Alert, Descriptions } from 'antd';
import type { ReportAgingTotals, ReportTurnoverTotals } from '@wms/contracts';
import { tonnes } from '@wms/contracts';

type Props =
  | { kind: 'turnover'; totals: ReportTurnoverTotals; fromDay: string; toDay: string; adjustmentCount: number; stocktakeCount: number; incomplete: boolean }
  | { kind: 'aging'; totals: ReportAgingTotals; cutoffDay: string; fromDay: string; toDay: string; adjustmentCount: number; stocktakeCount: number; incomplete: boolean };

function formatted(value: number | null, unit: 'grams' | 'integer') {
  return value === null ? '—（不可验证）' : unit === 'grams' ? tonnes(value) : String(value);
}

export function DerivedSummary(props: Props) {
  const period = `本期含调整 ${props.adjustmentCount} 笔、含盘点回写 ${props.stocktakeCount} 次`;
  return (
    <section>
      <Alert
        type={props.incomplete ? 'warning' : 'info'}
        showIcon
        title={props.incomplete ? `未完结 · ${props.fromDay} 至 ${props.toDay}（今天不计入完整日）` : `完整期间 · ${props.fromDay} 至 ${props.toDay}`}
        description="调整与盘点回写进入日终余额 Q(d)，不进入净出库 O；调减或盘亏可能使周转率偏高。"
      />
      <Descriptions title="筛选范围合计" size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
        <Descriptions.Item label="本期库存变化说明">
          <span data-testid="report-adjustment-summary">{period}</span>
        </Descriptions.Item>
        {props.kind === 'turnover' ? (
          <>
            <Descriptions.Item label="净出库（吨）">{formatted(props.totals.netOutboundGrams, 'grams')}</Descriptions.Item>
            <Descriptions.Item label="Σ日终库存（吨·日）">{formatted(props.totals.dailyClosingGramsSum, 'grams')}</Descriptions.Item>
          </>
        ) : (
          <>
            <Descriptions.Item label="截止日">{props.cutoffDay}</Descriptions.Item>
            <Descriptions.Item label="账面包数">{formatted(props.totals.closingPackages, 'integer')}</Descriptions.Item>
            <Descriptions.Item label="0–30 天（吨）">{formatted(props.totals.age0To30Grams, 'grams')}</Descriptions.Item>
            <Descriptions.Item label="31–90 天（吨）">{formatted(props.totals.age31To90Grams, 'grams')}</Descriptions.Item>
            <Descriptions.Item label="91–180 天（吨）">{formatted(props.totals.age91To180Grams, 'grams')}</Descriptions.Item>
            <Descriptions.Item label="181–365 天（吨）">{formatted(props.totals.age181To365Grams, 'grams')}</Descriptions.Item>
            <Descriptions.Item label=">365 天（吨）">{formatted(props.totals.ageOver365Grams, 'grams')}</Descriptions.Item>
            <Descriptions.Item label="无法归龄（吨）">{formatted(props.totals.unagedGrams, 'grams')}</Descriptions.Item>
            <Descriptions.Item label="截止库存（吨）">{formatted(props.totals.closingGrams, 'grams')}</Descriptions.Item>
          </>
        )}
      </Descriptions>
    </section>
  );
}
