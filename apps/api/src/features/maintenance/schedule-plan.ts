import { MAINTENANCE } from '@wms/contracts';

export function scheduleEnabled(env: NodeJS.ProcessEnv): boolean {
  if (env.MAINTENANCE_SCHEDULER_ENABLED !== undefined) return env.MAINTENANCE_SCHEDULER_ENABLED === 'true';
  return env.NODE_ENV !== 'test';
}
export function scheduleDay(now: Date): { day: string; due: boolean } {
  const shanghai = new Date(now.getTime() + MAINTENANCE.shanghaiOffsetMs);
  return { day: shanghai.toISOString().slice(0, 10), due: shanghai.getUTCHours() >= MAINTENANCE.schedulerHour };
}
export function startupOverdue(lastSuccess: string | null, now: Date): boolean {
  return lastSuccess === null || now.getTime() - Date.parse(lastSuccess) > MAINTENANCE.dayMs;
}
