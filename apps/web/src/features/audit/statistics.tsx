import type { AuditStatistics as Statistics } from '@wms/contracts';
import { auditCopy as t } from './text';
import { SectionTitle, StatCard } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';

export function AuditStatistics({
  data,
  filter,
}: {
  data?: Statistics;
  filter: (patch: Record<string, string>) => void;
}) {
  const metrics = [
    { label: t.records, value: data?.records, type: 'default' as const },
    { label: t.failures, value: data?.failures, type: 'error' as const, action: () => filter({ result: 'failed' }) },
    { label: t.objects, value: data?.objects, type: 'default' as const },
    {
      label: t.dangerousCount,
      value: data?.dangerous,
      type: 'warning' as const,
      action: () => filter({ dangerous: 'true' }),
    },
  ];
  return (
    <div data-testid="audit-statistics" style={{ display: 'grid', gap: spacing[8] }}>
      <SectionTitle title={data?.today ? t.today : t.current} />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gridAutoRows: '1fr',
          gap: spacing[16],
        }}
      >
        {metrics.map((metric) => (
          <StatCard
            key={metric.label}
            label={metric.label}
            value={metric.value ?? '—'}
            type={metric.type}
            onClick={metric.action}
          />
        ))}
      </div>
    </div>
  );
}
