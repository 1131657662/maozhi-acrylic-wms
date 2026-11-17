import { useMemo } from 'react';
import { theme } from 'antd';
import type { Analysis } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { AnalysisSection } from './analysis-section';
import { AnalysisPlot } from './analysis-plot';
import { dashboardCopy as copy } from './dashboard-copy';
import { chartCopy } from '../reports/chart-copy';
import { MovementSummary, SummaryValue } from './analysis-summaries';
import { chartTonnes } from '../reports/chart-options';
import { agingOption, heatmapOption, turnoverOption } from './derived-chart-options';
import { openReport } from '../reports/navigation';
import { analysisLink } from './drilldown';

const agingBands = [
  'age0To30Grams',
  'age31To90Grams',
  'age91To180Grams',
  'age181To365Grams',
  'ageOver365Grams',
  'unagedGrams',
] as const;

export function AgingSection({ block }: { block: Analysis['aging'] }) {
  const { token } = theme.useToken(),
    option = useMemo(() => (block.data ? agingOption(block.data, token) : null), [block.data, token]),
    hasData = Boolean(
      block.data && [...block.data.buckets, block.data.unagedGrams].some((value) => value !== null && value > 0),
    );
  return (
    <AnalysisSection title={copy.aging} block={block}>
      {(data) => (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[16], marginBottom: spacing[8] }}>
            <SummaryValue label={copy.closing} value={chartTonnes(data.closingGrams)} unit={copy.tonnes} />
            <SummaryValue label={copy.unaged} value={chartTonnes(data.unagedGrams)} unit={copy.tonnes} />
          </div>
          <AnalysisPlot
            block={block}
            option={option}
            description={copy.chartDescription.aging}
            onPointClick={(event) => openReport(analysisLink('aging', block, agingBands[event.dataIndex ?? 0]!))}
            hasVisibleData={hasData}
          />
        </>
      )}
    </AnalysisSection>
  );
}

export function TurnoverSection({ block }: { block: Analysis['turnover'] }) {
  const { token } = theme.useToken(),
    option = useMemo(() => (block.data ? turnoverOption(block.data, token) : null), [block.data, token]),
    hasData = Boolean(block.data?.some((point) => point.turns !== null || point.turnoverDays !== null));
  return (
    <AnalysisSection title={copy.turnover} block={block}>
      {(data) => {
        const latest = data.at(-1);
        return (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[16], marginBottom: spacing[8] }}>
              <strong>{latest?.month}</strong>
              <SummaryValue label={chartCopy.turns} value={latest?.turns ?? copy.unknown} />
              <SummaryValue label={chartCopy.days} value={latest?.turnoverDays ?? copy.unknown} />
            </div>
            <AnalysisPlot
              block={block}
              option={option}
              description={copy.chartDescription.turnover}
              onPointClick={(event) => openReport(analysisLink('turnover', block, event.name))}
              hasVisibleData={hasData}
            />
          </>
        );
      }}
    </AnalysisSection>
  );
}

export function HeatmapSection({ block }: { block: Analysis['heatmap'] }) {
  const { token } = theme.useToken(),
    option = useMemo(() => (block.data ? heatmapOption(block.data, token) : null), [block.data, token]),
    hasData = Boolean(block.data?.days.some((point) => point.value !== null && point.value !== 0));
  return (
    <AnalysisSection title={copy.heatmap} block={block}>
      {(data) => (
        <>
          <MovementSummary points={data.days} />
          <AnalysisPlot
            block={block}
            option={option}
            description={copy.chartDescription.heatmap}
            onPointClick={(event) => {
              const day = data.days[event.dataIndex ?? -1]?.day;
              if (day) openReport(analysisLink('day', block, day));
            }}
            hasVisibleData={hasData}
          />
        </>
      )}
    </AnalysisSection>
  );
}
