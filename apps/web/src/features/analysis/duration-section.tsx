import { Alert, Typography } from 'antd';
import type { Analysis } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { AnalysisSection } from './analysis-section';
import { dashboardCopy as copy } from './dashboard-copy';
import { SummaryValue } from './analysis-summaries';

function hourText(value: number | null): string {
  return value === null ? copy.unknown : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function pendingText(pending: NonNullable<NonNullable<Analysis['duration']['data']>['longestPending']>) {
  const kind = pending.kind === 'inbound' ? copy.pendingInbound : copy.pendingOutbound;
  return `${kind} · ${pending.number} · ${hourText(pending.elapsedHours)} ${copy.hours}`;
}

export function DurationSection({ block }: { block: Analysis['duration'] }) {
  return (
    <AnalysisSection title={copy.duration} block={block}>
      {(data) => (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[16], marginBottom: spacing[16] }}>
            <SummaryValue label={copy.averageInbound} value={hourText(data.inboundAverageHours)} unit={copy.hours} />
            <SummaryValue label={copy.inboundCompleted} value={data.inboundCompleted} />
            <SummaryValue label={copy.averageOutbound} value={hourText(data.outboundAverageHours)} unit={copy.hours} />
            <SummaryValue label={copy.outboundCompleted} value={data.outboundCompleted} />
          </div>
          <Typography.Text strong>{copy.longestPending}：</Typography.Text>
          {data.longestPending ? (
            <Typography.Text>{pendingText(data.longestPending)}</Typography.Text>
          ) : (
            <Alert type="info" showIcon title={copy.noPending} />
          )}
        </>
      )}
    </AnalysisSection>
  );
}
