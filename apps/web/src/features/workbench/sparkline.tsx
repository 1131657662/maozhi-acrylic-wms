import { Typography, theme } from 'antd';
import { tonnes, workbenchCopy as copy, type Workbench } from '@wms/contracts';
import { chartTheme } from '../reports/chart-theme';
import { spacing } from '../../theme/design-tokens';
export type Points = Workbench['trend14d']['data'];
const geometry = { width: 560, height: 100, pad: spacing[8] } as const;
function line(points: NonNullable<Points>, kind: 'inbound' | 'outbound', bounds: { max: number; min: number }) {
  const { width, height, pad } = geometry,
    { max, min } = bounds;
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
      <title>{trendTitle(points)}</title>
      {(['inbound', 'outbound'] as const)
        .filter((k) => !kind || k === kind)
        .map((k) => (
          <polyline
            key={k}
            points={line(points, k, { max, min })}
            fill="none"
            stroke={colors[k]}
            strokeWidth={token.lineWidthBold}
          />
        ))}
    </svg>
  );
}
function trendTitle(points: NonNullable<Points>) {
  return (
    copy.trend +
    ' · ' +
    points
      .map(
        (p) =>
          `${p.day} ${copy.inboundLine} ${tonnes(p.inbound.grams.value!)} ${copy.outboundLine} ${tonnes(p.outbound.grams.value!)}`,
      )
      .join('；')
  );
}
