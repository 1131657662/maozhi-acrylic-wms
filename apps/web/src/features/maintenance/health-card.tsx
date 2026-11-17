import { theme } from 'antd';
import { listTime, type MaintenanceCheck } from '@wms/contracts';
import { Card, SectionTitle, StatusTag } from '../../components/ui';
import { spacing, fontSize } from '../../theme/design-tokens';
import { maintenanceCopy as t } from './copy';
import { healthTones } from './presentation';

export function HealthCard({
  name,
  title,
  check,
  values,
}: {
  name: string;
  title: string;
  check: MaintenanceCheck;
  values: [string, string][];
}) {
  const { token } = theme.useToken();
  return (
    <Card
      testId={`maintenance-health-${name}`}
      title={<SectionTitle title={title} />}
      extra={<StatusTag status={t.healthStatus[check.status]} type={healthTones[check.status]} />}
    >
      <div style={{ display: 'grid', gap: spacing[8] }}>
        {check.reason && (
          <div style={{ color: check.status === 'error' ? token.colorError : token.colorTextSecondary }}>
            {check.reason}
          </div>
        )}
        {values.map(([label, value]) => (
          <div key={label}>
            {label}：{value}
          </div>
        ))}
        <div style={{ color: token.colorTextSecondary, fontSize: fontSize.auxiliary }}>
          {t.source}：{check.source}
        </div>
        <div style={{ color: token.colorTextSecondary, fontSize: fontSize.auxiliary }}>
          {t.checkedAt}：{listTime(check.checkedAt)}
        </div>
      </div>
    </Card>
  );
}
