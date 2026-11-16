import { WORKBENCH, type WorkbenchMetric, type WorkbenchPeriod } from '@wms/contracts';

export function metric(value: number | null, unit: WorkbenchMetric['unit'], period: WorkbenchPeriod): WorkbenchMetric {
  return {
    value,
    unit,
    period,
    basis: 'posted',
    verification: value === null ? 'unverifiable' : 'verified',
    reason: null,
  };
}
export function unknownMetric(unit: WorkbenchMetric['unit'], period: WorkbenchPeriod, reason: string): WorkbenchMetric {
  return { ...metric(null, unit, period), reason };
}
export function dashboardPeriod(asOf: string): WorkbenchPeriod {
  const day = new Date(Date.parse(asOf) + WORKBENCH.shanghaiOffsetMs).toISOString().slice(0, 10);
  return { from: new Date(`${day}T00:00:00+08:00`).toISOString(), to: asOf };
}
export function localTime(iso: string): string {
  return new Date(Date.parse(iso) + WORKBENCH.shanghaiOffsetMs).toISOString().replace('T', ' ').replace('Z', '000');
}
export const select = `SELECT /*+ MAX_EXECUTION_TIME(${WORKBENCH.queryTimeoutMs}) */`;
