import type { Analysis } from '@wms/contracts';
import { Typography } from 'antd';
import { dashboardCopy as copy } from './dashboard-copy';

function change(now: number | null, previous: number | null): string {
  if (now === null || previous === null) return copy.changeUnknown;
  if (previous === 0) return copy.zeroBase;
  return `${(((now - previous) / Math.abs(previous)) * 100).toFixed(2)}%`;
}

export function ComparisonChange({ data }: { data: NonNullable<Analysis['comparison']['data']> }) {
  return (
    <Typography.Paragraph type="secondary">
      {copy.inboundChange}：{change(data.current.inboundGrams, data.previous.inboundGrams)}；{copy.outboundChange}：
      {change(data.current.outboundGrams, data.previous.outboundGrams)}
    </Typography.Paragraph>
  );
}
