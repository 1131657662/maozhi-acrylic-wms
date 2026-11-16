import type { ReactNode } from 'react';
import { Alert, theme, Typography } from 'antd';
import type { Analysis } from '@wms/contracts';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { spacing } from '../../theme/design-tokens';
import { dashboardCopy as copy } from './dashboard-copy';

export type AnalysisBlock<T> = Omit<Analysis['monthly'], 'data'> & { data: T | null };

function periodLabel(block: AnalysisBlock<unknown>): string {
  return block.period.fromDay === block.period.toDay
    ? block.period.fromDay
    : `${block.period.fromDay} ${copy.periodSeparator} ${block.period.toDay}`;
}

function StatusText({ block }: { block: AnalysisBlock<unknown> }) {
  const { token } = theme.useToken(),
    color =
      block.verification === 'verified'
        ? token.colorSuccess
        : block.verification === 'failed'
          ? token.colorError
          : token.colorWarning;
  return (
    <Typography.Text style={{ color }}>
      {copy.verification}：{copy[block.verification]}
    </Typography.Text>
  );
}

function BasisText({ block }: { block: AnalysisBlock<unknown> }) {
  const label = block.basis === 'posted' ? copy.basisPosted : copy.basisRestated;
  return (
    <Typography.Text type="secondary">
      {copy.basisLabel}：{label}
    </Typography.Text>
  );
}

function SectionMetadata({ block }: { block: AnalysisBlock<unknown> }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8], marginBottom: spacing[8] }}>
      <Typography.Text type="secondary">
        {copy.period}：{periodLabel(block)}
      </Typography.Text>
      <Typography.Text type="secondary">
        {copy.unit}：{block.unit === '克' ? copy.tonnes : block.unit}
      </Typography.Text>
      <BasisText block={block} />
      <StatusText block={block} />
    </div>
  );
}

function SectionReason({ block }: { block: AnalysisBlock<unknown> }) {
  if (!block.reason) return null;
  return (
    <Alert
      type={block.verification === 'failed' ? 'error' : 'warning'}
      showIcon
      title={block.reason}
      style={{ marginBottom: spacing[8] }}
    />
  );
}

function SectionData<T>({ block, children }: { block: AnalysisBlock<T>; children: (data: T) => ReactNode }) {
  if (block.data === null) return <EmptyState description={block.reason ?? copy.noData} />;
  return children(block.data);
}

export function AnalysisSection<T>({
  title,
  block,
  children,
}: {
  title: string;
  block: AnalysisBlock<T>;
  children: (data: T) => ReactNode;
}) {
  return (
    <section data-testid={`analysis-${title}`}>
      <Card title={title}>
        <SectionMetadata block={block} />
        <SectionReason block={block} />
        <SectionData block={block}>{children}</SectionData>
      </Card>
    </section>
  );
}

export function chartState(block: AnalysisBlock<unknown>, hasVisibleData: boolean) {
  if (block.verification === 'failed') return 'error' as const;
  if (!hasVisibleData && block.verification === 'unverifiable') return 'unverifiable' as const;
  return hasVisibleData ? ('ready' as const) : ('empty' as const);
}
