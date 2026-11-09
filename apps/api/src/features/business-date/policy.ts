import { backdateThreshold, businessDateSchema, shanghaiToday } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';

export interface DateInput {
  businessDate?: string;
  backdateConfirmed?: boolean;
}
export function validateBusinessDate(input: DateInput, now = new Date()) {
  const today = shanghaiToday(now);
  const date = businessDateSchema.parse(input.businessDate ?? today);
  if (date > today) throw new AppError('BUSINESS_DATE_FUTURE', '业务日期不得晚于上海今天', 422);
  const old = date < backdateThreshold(today);
  if (old && input.backdateConfirmed !== true)
    throw new AppError('BUSINESS_DATE_CONFIRMATION_REQUIRED', '回填超过三个月，必须二次确认', 422);
  return { businessDate: date, backdateConfirmed: old && input.backdateConfirmed === true, checkedOn: today };
}
