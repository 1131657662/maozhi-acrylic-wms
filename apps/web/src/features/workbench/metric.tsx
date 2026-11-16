import { Tooltip } from 'antd';
import { listTime, tonnes, workbenchCopy as copy, type WorkbenchMetric } from '@wms/contracts';

export function metricText(metric: WorkbenchMetric | undefined): string {
  if (metric?.value == null) return copy.unknown;
  return `${metric.unit === '克' ? tonnes(metric.value) : metric.value.toLocaleString('zh-CN')} ${metric.unit === '克' ? copy.tonnes : metric.unit}`;
}
export function Metric({ metric }: { metric?: WorkbenchMetric }) {
  const title = metric
    ? `${copy.basis} · ${listTime(metric.period.from)} — ${listTime(metric.period.to)}${metric.reason ? ` · ${metric.reason}` : ''}`
    : copy.failed;
  return (
    <Tooltip title={title}>
      <span>{metricText(metric)}</span>
    </Tooltip>
  );
}
export const timeText = (value: string | null) => (value ? listTime(value) : copy.noTime);
