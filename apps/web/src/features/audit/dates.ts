import dayjs from 'dayjs';
import { shanghaiToday, AUDIT_DEFAULT_DAYS } from '@wms/contracts';
import { auditCopy as t } from './text';
export function auditDateDefaults() {
  const today = dayjs(shanghaiToday());
  return {
    from: `${today.subtract(AUDIT_DEFAULT_DAYS - 1, 'day').format('YYYY-MM-DD')}T00:00:00+08:00`,
    to: `${today.format('YYYY-MM-DD')}T23:59:59.999+08:00`,
  };
}
export function auditDatePresets() {
  const today = dayjs(shanghaiToday()),
    yesterday = today.subtract(1, 'day');
  return [
    { label: t.datePresets.today, value: [today, today] as [dayjs.Dayjs, dayjs.Dayjs] },
    { label: t.datePresets.yesterday, value: [yesterday, yesterday] as [dayjs.Dayjs, dayjs.Dayjs] },
    {
      label: t.datePresets.week,
      value: [today.subtract(AUDIT_DEFAULT_DAYS - 1, 'day'), today] as [dayjs.Dayjs, dayjs.Dayjs],
    },
    { label: t.datePresets.month, value: [today.startOf('month'), today] as [dayjs.Dayjs, dayjs.Dayjs] },
  ];
}
