import { Form, Typography, type FormInstance } from 'antd';
import { tonnes, type ShipmentQuantity } from '@wms/contracts';
import type { ActualForm } from './actual-lines';
import { shipmentCopy as text, SHIPMENT_UI as ui } from './shipment-copy';

export function ShipmentDifference({
  line,
  form,
  index,
}: {
  line: ShipmentQuantity;
  form: FormInstance<ActualForm>;
  index: number;
}) {
  const value = Form.useWatch(['lines', index], form) as ActualForm['lines'][number] | undefined;
  const packages = value?.actualPackages == null ? null : value.actualPackages - line.remainingPackages;
  const grams =
    value?.actualWeightTonnes == null
      ? null
      : Math.round(value.actualWeightTonnes * ui.gramsPerTonne) - line.remainingWeightGrams;
  return (
    <div>
      <DifferenceValue value={packages} weight={false} />
      <DifferenceValue value={grams} weight />
    </div>
  );
}
function DifferenceValue({ value, weight }: { value: number | null; weight: boolean }) {
  if (value === null) return <div>{text.empty}</div>;
  const label = `${value > 0 ? '+' : ''}${weight ? tonnes(value) : value} ${weight ? text.tonneUnit : text.packageUnit}`;
  return (
    <div>
      <Typography.Text type={value > 0 ? 'warning' : value < 0 ? 'danger' : undefined}>
        {label}
        {value > 0 ? text.overage : value < 0 ? text.shortage : ''}
      </Typography.Text>
    </div>
  );
}
