import { Button, Space, Statistic, theme } from 'antd';
import type { AuditStatistics as Statistics } from '@wms/contracts';
import { auditCopy as t } from './text';

export function AuditStatistics({
  data,
  filter,
}: {
  data?: Statistics;
  filter: (patch: Record<string, string>) => void;
}) {
  const { token } = theme.useToken();
  const metrics = [
    { label: t.records, value: data?.records },
    { label: t.failures, value: data?.failures, color: token.colorError, action: () => filter({ result: 'failed' }) },
    { label: t.objects, value: data?.objects },
    {
      label: t.dangerousCount,
      value: data?.dangerous,
      color: token.colorWarning,
      action: () => filter({ dangerous: 'true' }),
    },
  ];
  return (
    <div data-testid="audit-statistics" style={{ marginBottom: token.margin }}>
      <strong>{data?.today ? t.today : t.current}</strong>
      <Space wrap size="large" style={{ display: 'flex', marginTop: token.marginXS }}>
        {metrics.map((metric) => (
          <Statistic
            key={metric.label}
            title={
              metric.action ? (
                <Button size="small" type="link" onClick={metric.action}>
                  {metric.label}
                </Button>
              ) : (
                metric.label
              )
            }
            value={metric.value ?? '—'}
            styles={{ content: { color: metric.color, fontSize: token.fontSizeHeading3 } }}
          />
        ))}
      </Space>
    </div>
  );
}
