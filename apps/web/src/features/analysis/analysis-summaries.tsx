import type { ReactNode } from 'react';
import { Typography } from 'antd';
import { chartTonnes } from '../reports/chart-options';
import { chartCopy } from '../reports/chart-copy';
import { spacing } from '../../theme/design-tokens';
import { dashboardCopy as copy } from './dashboard-copy';

export type MovementPoint = { inboundGrams: number | null; outboundGrams: number | null };

function knownTotal(values: (number | null)[]): number | null {
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

export function MovementSummary({ points, children }: { points: MovementPoint[]; children?: ReactNode }) {
  const inbound = knownTotal(points.map((point) => point.inboundGrams)),
    outbound = knownTotal(points.map((point) => point.outboundGrams));
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[16], marginBottom: spacing[8] }}>
      <Typography.Text>
        {chartCopy.inbound}：{chartTonnes(inbound)} {copy.tonnes}
      </Typography.Text>
      <Typography.Text>
        {chartCopy.outbound}：{chartTonnes(outbound)} {copy.tonnes}
      </Typography.Text>
      {children}
    </div>
  );
}

export function SummaryValue({ label, value, unit }: { label: string; value: ReactNode; unit?: string }) {
  return (
    <Typography.Text>
      {label}：{value}
      {unit ? ` ${unit}` : ''}
    </Typography.Text>
  );
}
