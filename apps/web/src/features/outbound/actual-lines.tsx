import { Form, InputNumber, Table, Typography, Flex, type FormInstance } from 'antd';
import {
  OUTBOUND_ACTUAL_MAX_GRAMS,
  OUTBOUND_ACTUAL_MAX_PACKAGES,
  documentExtraCopy,
  snapshotText,
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
  return (
    <Table<ShipmentQuantity>
      rowKey="lineId"
      dataSource={lines}
      pagination={false}
      tableLayout="fixed"
      scroll={{ x: ui.tableWidth }}
      data-testid="actual-lines"
      columns={[
        {
          title: text.product,
          width: ui.productWidth,
          render: (_, line) => (
            <>
              <div>{line.productName}</div>
              <Typography.Text type="secondary">{line.productCode}</Typography.Text>
              <div>
                <Typography.Text type="secondary">
                  {documentExtraCopy.contractNo}：{snapshotText(line.contractNo)}
                </Typography.Text>
              </div>
              <div>
                <Typography.Text type="secondary">
                  {documentExtraCopy.lineMemo}：{snapshotText(line.memo)}
                </Typography.Text>
              </div>
            </>
          ),
        },
        {
          title: text.planLine,
          width: ui.quantityWidth,
          align: 'right',
          onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          render: (_, line) => text.quantity(line.plannedPackages, line.plannedWeightGrams),
        },
        {
          title: text.shippedLine,
          width: ui.quantityWidth,
          align: 'right',
          onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          render: (_, line) => text.quantity(line.effectivePackages, line.effectiveWeightGrams),
        },
        {
          title: text.pendingLine,
          width: ui.quantityWidth,
          align: 'right',
          onHeaderCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          onCell: () => ({ style: { whiteSpace: 'nowrap' } }),
          render: (_, line) => text.quantity(line.remainingPackages, line.remainingWeightGrams),
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
          render: (_, line, index) =>
            form ? <ShipmentDifference line={line} form={form} index={index} /> : text.empty,
        },
      ]}
    />
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
