import { Alert, Form, Input, Typography, Flex } from 'antd';
import type { ActualQuantity, ShipmentList } from '@wms/contracts';
import { VehicleField } from '../master-data/vehicle-field';
import { shipmentCopy as text, SHIPMENT_UI as ui } from './shipment-copy';
import { ShipmentDifferenceValue } from './shipment-difference';

export function ActualConfirmContent({ data, lines }: { data: ShipmentList; lines: ActualQuantity[] }) {
  const form = Form.useFormInstance();
  const active = lines.filter((line) => line.actualPackages || line.actualWeightGrams);
  const packages = lines.reduce((sum, line) => sum + line.actualPackages, 0);
  const grams = lines.reduce((sum, line) => sum + line.actualWeightGrams, 0);
  return (
    <Flex vertical gap="middle">
      <VehicleField />
      <Typography.Text strong>{text.total(active.length, text.quantity(packages, grams))}</Typography.Text>
      {lines.map((line, index) =>
        line.actualPackages || line.actualWeightGrams ? (
          <div key={line.lineId}>
            <div>
              <Typography.Text>{data.lines[index]!.productName}</Typography.Text>
            </div>
            <Typography.Text>{text.quantity(line.actualPackages, line.actualWeightGrams)}</Typography.Text>
            <div>
              <Typography.Text type="secondary">
                {text.difference}：
                <ShipmentDifferenceValue
                  packages={line.actualPackages - data.lines[index]!.remainingPackages}
                  grams={line.actualWeightGrams - data.lines[index]!.remainingWeightGrams}
                />
              </Typography.Text>
            </div>
            <Form.Item name={['lines', index, 'overageReason']} label={text.reason}>
              <Input.TextArea
                autoSize
                maxLength={ui.reasonMax}
                placeholder={text.reasonHint}
                onChange={() => form.setFields([{ name: ['lines', index, 'overageReason'], errors: [] }])}
              />
            </Form.Item>
          </div>
        ) : null,
      )}
      <Alert type="warning" title={text.notice(data.nextSeq)} />
    </Flex>
  );
}
