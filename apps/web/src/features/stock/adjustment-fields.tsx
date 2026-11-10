import { Alert, Form } from 'antd';
import { ProFormDigit, ProFormTextArea } from '@ant-design/pro-components';
import { tonnes, type StockBalance } from '@wms/contracts';
import { tonnesDeltaToGrams } from '../../lib/weight-input';

export interface AdjustmentValues {
  packagesDelta: number;
  weightTonnesDelta: number;
  reason: string;
}
export function AdjustmentFields({ before }: { before: StockBalance }) {
  const packages = Form.useWatch<number>('packagesDelta') ?? 0;
  const weight = Form.useWatch<number>('weightTonnesDelta') ?? 0;
  const afterPackages = before.packages + packages;
  const afterWeight = before.weightGrams + tonnesDeltaToGrams(weight);
  return (
    <>
      <ProFormDigit
        name="packagesDelta"
        label="包数调整量"
        rules={[{ required: true }]}
        fieldProps={{ precision: 0, min: -2147483647, max: 2147483647 }}
        extra="增加填正数，减少填负数；包数和重量分别填写。"
      />
      <ProFormDigit
        name="weightTonnesDelta"
        label="重量调整量（吨）"
        dependencies={['packagesDelta']}
        rules={[
          { required: true },
          ({ getFieldValue }) => ({
            validator: (_, value) =>
              value === 0 && getFieldValue('packagesDelta') === 0
                ? Promise.reject(new Error('包数或重量至少有一项调整量不为零'))
                : Promise.resolve(),
          }),
        ]}
        fieldProps={{ precision: 4, min: -99999999.9999, max: 99999999.9999, step: 0.0001 }}
      />
      <Alert
        type={afterPackages < 0 || afterWeight < 0 ? 'error' : 'info'}
        showIcon
        title="调整后预览（尚未提交）"
        description={`${afterPackages} 包 / ${tonnes(afterWeight)} 吨；保存成功后生效。`}
      />
      <ProFormTextArea
        name="reason"
        label="调整原因"
        rules={[{ required: true, whitespace: true, message: '请填写调整原因' }]}
        fieldProps={{ maxLength: 500, rows: 3, showCount: true }}
      />
    </>
  );
}
