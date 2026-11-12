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
  return <ShipmentDifferenceValue packages={packages} grams={grams} />;
}
function signedQuantity(value: number | null, weight = false) {
  if (value === null) return text.empty;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${weight ? tonnes(Math.abs(value)) : Math.abs(value)} ${weight ? text.tonneUnit : text.packageUnit}`;
}
export function ShipmentDifferenceValue({ packages, grams }: { packages: number | null; grams: number | null }) {
  if (packages === null && grams === null) return <>{text.empty}</>;
  const overage = (packages ?? 0) > 0 || (grams ?? 0) > 0;
  const shortage = (packages ?? 0) < 0 || (grams ?? 0) < 0;
  const status =
    overage && shortage
      ? text.mixedDifference(
          packages! > 0 ? text.overageWord : text.shortageWord,
          grams! > 0 ? text.overageWord : text.shortageWord,
        )
      : overage
        ? text.overage
        : shortage
          ? text.shortage
          : '';
  return (
    <Typography.Text style={{ whiteSpace: 'nowrap' }} type={overage ? 'warning' : shortage ? 'danger' : undefined}>
      {signedQuantity(packages)} / {signedQuantity(grams, true)}
      {status}
    </Typography.Text>
  );
}
