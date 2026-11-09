import { Card, Form, InputNumber, Space, Typography } from 'antd';
import { tonnes, type CorrectionSummary } from '@wms/contracts';
import { gramsToTonnes, tonnesDeltaToGrams } from '../../lib/weight-input';

export interface CorrectionFormValues {
  reason: string;
  lines: { packages: number; weightTonnes: number }[];
}
export function CorrectionLineFields({ line, index }: { line: CorrectionSummary['lines'][number]; index: number }) {
  const form = Form.useFormInstance<CorrectionFormValues>();
  const packages = Form.useWatch(['lines', index, 'packages'], form) ?? line.effective.packages;
  const weight = Form.useWatch(['lines', index, 'weightTonnes'], form) ?? gramsToTonnes(line.effective.weightGrams);
  const packagesDelta = packages - line.effective.packages;
  const weightDelta = tonnesDeltaToGrams(weight) - line.effective.weightGrams;
  return (
    <Card size="small" title={`${line.productCode} · ${line.productName}`}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Typography.Text>
          原单值：{line.original.packages} 包 / {tonnes(line.original.weightGrams)} 吨
        </Typography.Text>
        <Typography.Text>
          更正前有效值：{line.effective.packages} 包 / {tonnes(line.effective.weightGrams)} 吨
        </Typography.Text>
        <Form.Item name={['lines', index, 'packages']} label="更正后包数" rules={[{ required: true }]}>
          <InputNumber min={0} max={1_000_000} precision={0} aria-label={`${line.productCode} 更正后包数`} />
        </Form.Item>
        <Form.Item name={['lines', index, 'weightTonnes']} label="更正后吨数" rules={[{ required: true }]}>
          <InputNumber
            min={0}
            max={99999999.9999}
            precision={4}
            step={0.0001}
            aria-label={`${line.productCode} 更正后吨数`}
          />
        </Form.Item>
        <Typography.Text role="status">
          本次差额：{packagesDelta >= 0 ? '+' : ''}
          {packagesDelta} 包 / {weightDelta >= 0 ? '+' : ''}
          {tonnes(weightDelta)} 吨
        </Typography.Text>
      </Space>
    </Card>
  );
}
