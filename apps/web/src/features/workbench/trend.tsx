import { Typography, theme } from 'antd';
import { Link } from '@umijs/max';
import { tonnes, workbenchCopy as copy, type Workbench } from '@wms/contracts';
import { Card } from '../../components/ui/Card';
import { spacing } from '../../theme/design-tokens';
import { chartTheme } from '../reports/chart-theme';
import { metricText } from './metric';

type Points = Workbench['trend14d']['data'];
const geometry = { width: 560, height: 100, pad: 8, stroke: 2 } as const;
function line(points: NonNullable<Points>, kind: 'inbound' | 'outbound', max: number, min: number) {
  const { width, height, pad } = geometry;
  return points
    .map(
      (p, i) =>
        `${pad + (i * (width - pad * 2)) / (points.length - 1)},${height - pad - ((p[kind].grams.value! - min) / (max - min || 1)) * (height - pad * 2)}`,
    )
    .join(' ');
}
export function Sparkline({ points, kind }: { points: Points; kind?: 'inbound' | 'outbound' }) {
  const { token } = theme.useToken(),
    colors = chartTheme(token);
  if (!points?.length || points.some((p) => p.inbound.grams.value === null || p.outbound.grams.value === null))
    return null;
  const values = points.flatMap((p) => [p.inbound.grams.value!, p.outbound.grams.value!]);
  const max = Math.max(...values, 0),
    min = Math.min(...values, 0);
  if (values.every((v) => v === 0)) return <Typography.Text type="secondary">{copy.noTrend}</Typography.Text>;
  return (
    <svg
      role="img"
      aria-label={copy.trend}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      style={{ width: '100%', display: 'block' }}
    >
      <title>
        {copy.trend} ·{' '}
        {points
          .map(
            (p) =>
              `${p.day} ${copy.inboundLine} ${tonnes(p.inbound.grams.value!)} ${copy.outboundLine} ${tonnes(p.outbound.grams.value!)}`,
          )
          .join('；')}
      </title>
      {(['inbound', 'outbound'] as const)
        .filter((k) => !kind || k === kind)
        .map((k) => (
          <polyline
            key={k}
            points={line(points, k, max, min)}
            fill="none"
            stroke={colors[k]}
            strokeWidth={geometry.stroke}
          />
        ))}
    </svg>
  );
}
export default function Trend({ block }: { block: Workbench['trend14d'] }) {
  const { token } = theme.useToken(),
    colors = chartTheme(token);
  return (
    <Card
      title={copy.trend}
      extra={<Link to="/reports/monthly?scope=inventory&basis=posted">{copy.viewReports}</Link>}
      testId="workbench-trend"
    >
      {block.reason ? (
        <Typography.Text type="secondary">{block.reason}</Typography.Text>
      ) : (
        <>
          <div style={{ display: 'flex', gap: spacing[16] }}>
            <span style={{ color: colors.inbound }}>
              {copy.inboundLine} · {copy.tonnes}
            </span>
            <span style={{ color: colors.outbound }}>
              {copy.outboundLine} · {copy.tonnes}
            </span>
          </div>
          <Sparkline points={block.data} />
          <Typography.Paragraph type="secondary">
            {block.data?.[0]?.day} — {block.data?.at(-1)?.day}
          </Typography.Paragraph>
          <details>
            <summary>{copy.dailyValues}</summary>
            {block.data?.map((p) => (
              <div key={p.day}>
                {p.day} · {copy.inboundLine} {metricText(p.inbound.grams)} / {copy.outboundLine}{' '}
                {metricText(p.outbound.grams)}
              </div>
            ))}
          </details>
        </>
      )}
    </Card>
  );
}
