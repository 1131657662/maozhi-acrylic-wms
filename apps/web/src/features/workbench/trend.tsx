import { Typography, theme } from 'antd';
import { Link } from '@umijs/max';
import { workbenchCopy as copy, type Workbench } from '@wms/contracts';
import { Card } from '../../components/ui/Card';
import { spacing } from '../../theme/design-tokens';
import { chartTheme } from '../reports/chart-theme';
import { metricText } from './metric';

import { Sparkline, type Points } from './sparkline';
export { Sparkline } from './sparkline';
export default function Trend({ block }: { block: Workbench['trend14d'] }) {
  return (
    <Card
      title={copy.trend}
      extra={<Link to="/reports/monthly?scope=inventory&basis=posted">{copy.viewReports}</Link>}
      testId="workbench-trend"
    >
      {block.reason ? (
        <Typography.Text type="secondary">{block.reason}</Typography.Text>
      ) : (
        <TrendValues points={block.data} />
      )}
    </Card>
  );
}

function TrendValues({ points }: { points: Points }) {
  const { token } = theme.useToken(),
    colors = chartTheme(token);
  return (
    <>
      <div style={{ display: 'flex', gap: spacing[16] }}>
        <span style={{ color: colors.inbound }}>
          {copy.inboundLine} · {copy.tonnes}
        </span>
        <span style={{ color: colors.outbound }}>
          {copy.outboundLine} · {copy.tonnes}
        </span>
      </div>
      <Sparkline points={points} />
      <Typography.Paragraph type="secondary">
        {points?.[0]?.day} — {points?.at(-1)?.day}
      </Typography.Paragraph>
      <DailyValues points={points} />
    </>
  );
}

function DailyValues({ points }: { points: Points }) {
  return (
    <details>
      <summary>{copy.dailyValues}</summary>
      {points?.map((p) => (
        <div key={p.day}>
          {p.day} · {copy.inboundLine} {metricText(p.inbound.grams)} / {copy.outboundLine}{' '}
          {metricText(p.outbound.grams)}
        </div>
      ))}
    </details>
  );
}
