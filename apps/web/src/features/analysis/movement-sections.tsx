import { useMemo, useState } from 'react';
import { theme, Segmented } from 'antd';
import type { Analysis } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { AnalysisSection } from './analysis-section';
import { AnalysisPlot } from './analysis-plot';
import { dashboardCopy as copy } from './dashboard-copy';
import { compareOption, trendOption } from './movement-chart-options';
import { MovementSummary, SummaryValue } from './analysis-summaries';
import { chartTonnes } from '../reports/chart-options';
import { chartCopy } from '../reports/chart-copy';
import { openReport } from '../reports/drilldown';
import { analysisLink } from './drilldown';
import { ComparisonChange } from './comparison-change';

export function TrendSection({ block }: { block: Analysis['monthly'] }) {
  const { token } = theme.useToken(),
    [unit, setUnit] = useState<'grams' | 'packages'>('grams'),
    option = useMemo(() => (block.data ? trendOption(block.data, token, unit) : null), [block.data, token, unit]),
    hasData = Boolean(
      block.data?.points.some((point) =>
        unit === 'grams'
          ? (point.inboundGrams ?? 0) !== 0 || (point.outboundGrams ?? 0) !== 0
          : (point.inboundPackages ?? 0) !== 0 || (point.outboundPackages ?? 0) !== 0,
      ),
    );
  return (
    <AnalysisSection title={copy.trend} block={block}>
      {(data) => (
        <>
          <MovementSummary points={data.points}>
            <Segmented
              aria-label={copy.trendUnit}
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'grams', label: chartCopy.quantity },
                { value: 'packages', label: chartCopy.packages },
              ]}
            />
          </MovementSummary>
          <AnalysisPlot
            block={block}
            option={option}
            onPointClick={(event) => openReport(analysisLink('monthly', block, event.name))}
            description={copy.chartDescription.trend}
            hasVisibleData={hasData}
          />
        </>
      )}
    </AnalysisSection>
  );
}

export function ComparisonSection({ block }: { block: Analysis['comparison'] }) {
  const { token } = theme.useToken(),
    option = useMemo(() => (block.data ? compareOption(block.data, token) : null), [block.data, token]),
    sides = block.data ? [block.data.current, block.data.previous] : [],
    hasData = sides.some((side) => (side.inboundGrams ?? 0) !== 0 || (side.outboundGrams ?? 0) !== 0);
  return (
    <AnalysisSection title={copy.comparison} block={block}>
      {(data) => (
        <>
          <TypographySummary
            label={data.current.fromDay + ' 至 ' + data.current.toDay}
            inbound={data.current.inboundGrams}
            outbound={data.current.outboundGrams}
          />
          <TypographySummary
            label={data.previous.fromDay + ' 至 ' + data.previous.toDay}
            inbound={data.previous.inboundGrams}
            outbound={data.previous.outboundGrams}
          />
          <ComparisonChange data={data} />
          <AnalysisPlot
            block={block}
            option={option}
            onPointClick={(event) =>
              openReport(analysisLink('comparison', block, event.dataIndex === 1 ? 'previous' : 'current'))
            }
            description={copy.chartDescription.comparison}
            hasVisibleData={hasData}
          />
        </>
      )}
    </AnalysisSection>
  );
}

function TypographySummary({
  label,
  inbound,
  outbound,
}: {
  label: string;
  inbound: number | null;
  outbound: number | null;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[16], marginBottom: spacing[8] }}>
      <strong>{label}</strong>
      <SummaryValue label={chartCopy.inbound} value={chartTonnes(inbound)} unit={copy.tonnes} />
      <SummaryValue label={chartCopy.outbound} value={chartTonnes(outbound)} unit={copy.tonnes} />
    </div>
  );
}
