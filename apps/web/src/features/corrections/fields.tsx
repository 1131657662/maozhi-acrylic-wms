import { Card, Form, InputNumber, Select, Space, Typography } from 'antd';
import { tonnes, correctionCopy, type CorrectionSummary } from '@wms/contracts';
import { gramsToTonnes, tonnesDeltaToGrams } from '../../lib/weight-input';
import { formatTime } from '../../lib/format-time';

export interface CorrectionFormValues {
  reason: string;
  lines: { shipmentLineId?: string; packages: number; weightTonnes: number }[];
}
export function selectedCorrectionLine(line: CorrectionSummary['lines'][number], shipmentLineId?: string) {
  const shipment = line.shipments?.find((sh) => sh.shipmentLineId === shipmentLineId);
  return shipment ? { ...line, original: shipment.original, effective: shipment.effective } : line;
}
export function CorrectionLineFields({ line, index }: { line: CorrectionSummary['lines'][number]; index: number }) {
  const form = Form.useFormInstance<CorrectionFormValues>();
  const selected = Form.useWatch(['lines', index, 'shipmentLineId'], form) ?? line.shipments?.[0]?.shipmentLineId;
  line = selectedCorrectionLine(line, selected);
  const packages = Form.useWatch(['lines', index, 'packages'], form) ?? line.effective.packages;
  const weight = Form.useWatch(['lines', index, 'weightTonnes'], form) ?? gramsToTonnes(line.effective.weightGrams);
  const packagesDelta = packages - line.effective.packages;
  const weightDelta = tonnesDeltaToGrams(weight) - line.effective.weightGrams;
  return (
    <Card size="small" title={`${line.productCode} · ${line.productName}`}>
      <Space orientation="vertical" style={{ width: '100%' }}>
        {Boolean(line.shipments?.length) && (
          <Form.Item
            name={['lines', index, 'shipmentLineId']}
            label={correctionCopy.chooseShipment}
            rules={[{ required: true, message: correctionCopy.chooseShipment }]}
          >
            <Select
              aria-label={correctionCopy.chooseShipment}
              options={line.shipments!.map((sh) => ({
                value: sh.shipmentLineId,
                label: correctionCopy.shipment(sh.seq, sh.vehicleNo, formatTime(sh.shippedAt)),
              }))}
              onChange={(id) => {
                const next = selectedCorrectionLine(line, id);
                form.setFieldValue(['lines', index, 'packages'], next.effective.packages);
                form.setFieldValue(['lines', index, 'weightTonnes'], gramsToTonnes(next.effective.weightGrams));
              }}
            />
          </Form.Item>
        )}
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
