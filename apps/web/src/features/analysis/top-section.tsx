import { useMemo } from 'react';
import { theme } from 'antd';
import { Link } from '@umijs/max';
import type { Analysis } from '@wms/contracts';
import { publicReportText } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { AnalysisSection, type AnalysisBlock } from './analysis-section';
import { AnalysisPlot } from './analysis-plot';
import { dashboardCopy as copy } from './dashboard-copy';
import { topOption } from './movement-chart-options';
import { chartTonnes } from '../reports/chart-options';
import { openReport } from '../reports/navigation';
import { analysisLink } from './drilldown';

type TopRows = NonNullable<Analysis['tops']['data']>['products'];

function TopChart({
  title,
  block,
  data,
  metric,
  description,
  target,
}: {
  title: string;
  block: AnalysisBlock<TopRows>;
  data: TopRows;
  metric: 'inbound' | 'outbound';
  description: string;
  target?: 'product' | 'customer';
}) {
  const { token } = theme.useToken(),
    option = useMemo(() => topOption(data, metric, token), [data, metric, token]);
  return (
    <div aria-label={title}>
      <strong>{title}</strong>
      <ol style={{ paddingInlineStart: spacing[24] }}>
        {data.map((item) => (
          <li key={item.code}>
            {target ? (
              <Link to={analysisLink(target, block, item.code)}>{publicReportText(item.name ?? item.code)}</Link>
            ) : (
              publicReportText(item.name ?? item.code)
            )}
            ：{chartTonnes(item.rankedGrams)} {copy.tonnes}
          </li>
        ))}
      </ol>
      <AnalysisPlot
        block={{ ...block, data }}
        option={option}
        description={description}
        onPointClick={
          target
            ? (event) => {
                const item = data[event.dataIndex ?? -1];
                if (item) openReport(analysisLink(target, block, item.code));
              }
            : undefined
        }
        hasVisibleData={data.length > 0}
      />
    </div>
  );
}

export function TopSection({ block }: { block: Analysis['tops'] }) {
  return (
    <AnalysisSection title={copy.tops} block={block}>
      {(data) => (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(${spacing[16] * 16}px, 1fr))`,
            gap: spacing[16],
          }}
        >
          <TopChart
            block={{ ...block, data: data.products }}
            title={copy.products}
            target="product"
            data={data.products}
            metric="outbound"
            description={copy.chartDescription.products}
          />
          <TopChart
            block={{ ...block, data: data.customers }}
            title={copy.customers}
            target="customer"
            data={data.customers}
            metric="outbound"
            description={copy.chartDescription.customers}
          />
          <TopChart
            block={{ ...block, data: data.suppliers }}
            title={copy.suppliers}
            data={data.suppliers}
            metric="inbound"
            description={copy.chartDescription.suppliers}
          />
        </div>
      )}
    </AnalysisSection>
  );
}
