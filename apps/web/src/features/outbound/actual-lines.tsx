import { Form, InputNumber, Table, Typography, Flex, theme, type FormInstance } from 'antd';
import {
  OUTBOUND_ACTUAL_MAX_GRAMS,
  OUTBOUND_ACTUAL_MAX_PACKAGES,
  documentExtraCopy,
  tonnes,
  type ShipmentQuantity,
} from '@wms/contracts';
import { shipmentCopy as text, SHIPMENT_UI as ui } from './shipment-copy';
import { ShipmentDifference } from './shipment-difference';

export interface ActualForm {
  lines: { actualPackages?: number | null; actualWeightTonnes?: number | null }[];
}
interface Props {
  lines: ShipmentQuantity[];
  form?: FormInstance<ActualForm>;
}

export function ActualLines({ lines, form }: Props) {
  const { token } = theme.useToken();
  return (
    <Table<ShipmentQuantity>
      rowKey="lineId"
      dataSource={lines}
      pagination={false}
      tableLayout="fixed"
      scroll={{ x: ui.tableWidth }}
      style={{ minWidth: 0 }}
      data-testid="actual-lines"
      columns={[
        {
          title: text.product,
          minWidth: ui.productWidth,
          ellipsis: { showTitle: false },
          onHeaderCell: () => ({ style: { minWidth: ui.productWidth, whiteSpace: 'nowrap' } }),
          onCell: () => ({ style: { minWidth: ui.productWidth } }),
          render: (_, line) => <ProductCell line={line} />,
        },
        {
          title: text.planLine,
          width: ui.quantityWidth,
          align: 'right',
          onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          render: (_, line) => <QuantityCell packages={line.plannedPackages} grams={line.plannedWeightGrams} />,
        },
        {
          title: text.shippedLine,
          width: ui.quantityWidth,
          align: 'right',
          onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          render: (_, line) => <QuantityCell packages={line.effectivePackages} grams={line.effectiveWeightGrams} />,
        },
        {
          title: text.pendingLine,
          width: ui.quantityWidth,
          align: 'right',
          onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          render: (_, line) => <QuantityCell packages={line.remainingPackages} grams={line.remainingWeightGrams} />,
        },
        {
          title: text.actual,
          width: ui.inputWidth,
          render: (_, _line, index) => (form ? <ActualInputs index={index} /> : text.empty),
        },
        {
          title: text.difference,
          width: ui.differenceWidth,
          align: 'right',
          onHeaderCell: () => ({ style: { paddingInline: token.paddingXS } }),
          onCell: () => ({ style: { paddingInline: token.paddingXS, fontSize: token.fontSizeSM } }),
          render: (_, line, index) =>
            form ? <ShipmentDifference line={line} form={form} index={index} /> : text.empty,
        },
      ]}
    />
  );
}

function ProductCell({ line }: { line: ShipmentQuantity }) {
  const extras = [
    line.contractNo?.trim() ? `${documentExtraCopy.contractNo}：${line.contractNo}` : null,
    line.memo?.trim() ? `${documentExtraCopy.lineMemo}：${line.memo}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div>
      <Typography.Text style={{ display: 'block' }} ellipsis={{ tooltip: line.productName }}>
        {line.productName}
      </Typography.Text>
      {extras && (
        <Typography.Text style={{ display: 'block' }} type="secondary" ellipsis={{ tooltip: extras }}>
          {extras}
        </Typography.Text>
      )}
    </div>
  );
}

function QuantityCell({ packages, grams }: { packages: number; grams: number }) {
  return (
    <>
      <div>
        {packages} {text.packageUnit}
      </div>
      <div>
        {tonnes(grams)} {text.tonneUnit}
      </div>
    </>
  );
}

function ActualInputs({ index }: { index: number }) {
  return (
    <Flex vertical gap="small">
      <Form.Item name={['lines', index, 'actualPackages']} noStyle>
        <InputNumber
          aria-label={`${text.packages} ${index + 1}`}
          placeholder={text.zero}
          min={0}
          max={OUTBOUND_ACTUAL_MAX_PACKAGES}
          precision={0}
          suffix={text.packageUnit}
        />
      </Form.Item>
      <Form.Item name={['lines', index, 'actualWeightTonnes']} noStyle>
        <InputNumber
          aria-label={`${text.tonnes} ${index + 1}`}
          placeholder={text.zero}
          min={0}
          max={OUTBOUND_ACTUAL_MAX_GRAMS / ui.gramsPerTonne}
          precision={ui.tonnePrecision}
          step={ui.tonneStep}
          suffix={text.tonneUnit}
        />
      </Form.Item>
    </Flex>
  );
}
