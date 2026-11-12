import { DatePicker, Form, Input, Typography } from 'antd';
import { DATE_CORRECTION_REASON_MAX, shanghaiToday } from '@wms/contracts';
import { dateCorrectionCopy as text, DATE_CORRECTION_UI as ui } from './copy';

export function DateFields({ current }: { current: string | null }) {
  return (
    <>
      <Form.Item label={text.current}>
        <Typography.Text>{current ?? text.unknown}</Typography.Text>
      </Form.Item>
      <Form.Item name="afterDate" label={text.next} rules={[{ required: true, message: text.dateRequired }]}>
        <DatePicker
          style={{ width: '100%' }}
          format="YYYY-MM-DD"
          disabledDate={(date) => date.format('YYYY-MM-DD') > shanghaiToday()}
        />
      </Form.Item>
      <Form.Item
        name="reason"
        label={text.reason}
        rules={[
          { required: true, whitespace: true, message: text.reasonRequired },
          { max: DATE_CORRECTION_REASON_MAX },
        ]}
      >
        <Input.TextArea rows={ui.reasonRows} maxLength={DATE_CORRECTION_REASON_MAX} showCount />
      </Form.Item>
    </>
  );
}
