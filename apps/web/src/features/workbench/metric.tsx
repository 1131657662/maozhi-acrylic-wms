import { Tooltip } from 'antd';
import { listTime, tonnes, workbenchCopy as copy, type WorkbenchMetric } from '@wms/contracts';

function metricParts(metric?: WorkbenchMetric) {
  if (metric?.value == null) return { value: copy.unknown, unit: '' };
  return metric.unit === '克'
    ? { value: tonnes(metric.value), unit: copy.tonnes }
    : { value: metric.value.toLocaleString('zh-CN'), unit: metric.unit };
}
export function metricText(metric?: WorkbenchMetric): string {
  const { value, unit } = metricParts(metric);
  return unit ? `${value} ${unit}` : value;
}
export function Metric({ metric, prominent = false }: { metric?: WorkbenchMetric; prominent?: boolean }) {
  const title = metric
    ? `${copy.basis} · ${listTime(metric.period.from)} — ${listTime(metric.period.to)}${metric.reason ? ` · ${metric.reason}` : ''}`
    : copy.failed;
  if (!prominent)
    return (
      <Tooltip title={title}>
        <span>{metricText(metric)}</span>
      </Tooltip>
    );
  const { value, unit } = metricParts(metric);
  return (
    <Tooltip title={title}>
      <span className="wms-workbench-kpi-readout">
        <span>{value}</span>
        {unit && (
          <>
            {' '}
            <span className="wms-workbench-kpi-unit">{unit}</span>
          </>
        )}
      </span>
    </Tooltip>
  );
}
export const timeText = (value: string | null) => (value ? listTime(value) : copy.noTime);
