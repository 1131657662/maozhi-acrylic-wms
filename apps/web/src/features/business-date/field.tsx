import dayjs from 'dayjs';
import { ProFormDatePicker } from '@ant-design/pro-components';
import { shanghaiToday } from '@wms/contracts';

export function BusinessDateField() {
  const today = shanghaiToday();
  return (
    <ProFormDatePicker
      name="businessDate"
      label="业务日期"
      initialValue={today}
      rules={[{ required: true }]}
      fieldProps={{ maxDate: dayjs(today), allowClear: false }}
      extra="默认上海当天；可回填过去日期，超过 3 个月需二次确认。确认入账后锁定。"
    />
  );
}
