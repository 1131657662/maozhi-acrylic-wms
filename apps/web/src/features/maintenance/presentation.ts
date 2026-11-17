import type { MaintenanceJob, MaintenanceCheck } from '@wms/contracts';
import type { StatusTagType } from '../../components/ui/StatusTag';
import { MAINTENANCE_UI, maintenanceCopy as t } from './copy';

export const latencyText = (ms: number) => `${ms.toFixed(MAINTENANCE_UI.decimals)} ${t.milliseconds}`;

export const jobTones: Record<MaintenanceJob['status'], StatusTagType> = {
  queued: 'processing',
  running: 'processing',
  succeeded: 'success',
  failed: 'error',
  interrupted: 'error',
};
export const healthTones: Record<MaintenanceCheck['status'], StatusTagType> = {
  ok: 'success',
  error: 'error',
  unsupported: 'default',
  pending: 'processing',
};
export const bytesText = (bytes: number) =>
  new Intl.NumberFormat('zh-CN', { style: 'unit', unit: 'byte', unitDisplay: 'long' }).format(bytes);
export const durationText = (ms: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'unit',
    unit: 'second',
    unitDisplay: 'long',
    maximumFractionDigits: MAINTENANCE_UI.decimals,
  }).format(ms / MAINTENANCE_UI.secondsMs);
export const diskText = (bytes: number) =>
  new Intl.NumberFormat('zh-CN', {
    style: 'unit',
    unit: 'gigabyte',
    unitDisplay: 'long',
    maximumFractionDigits: MAINTENANCE_UI.decimals,
  }).format(bytes / MAINTENANCE_UI.gigabyteBytes);
