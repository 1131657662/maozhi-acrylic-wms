import { Form, InputNumber, Table, Typography, theme, type FormInstance } from 'antd';
import { tonnes, type Detail, OUTBOUND_ACTUAL_MAX_GRAMS, OUTBOUND_ACTUAL_MAX_PACKAGES } from '@wms/contracts';
import { actualText as text, ACTUAL_TABLE_WIDTH } from './actual-text';

export interface ActualForm {
  lines: { actualPackages?: number; actualWeightTonnes?: number }[];
}
interface Props {
  order: Detail;
  form: FormInstance<ActualForm>;
  editable: boolean;
}
export function ActualLines({ order, form, editable }: Props) {
  const { token } = theme.useToken();
  const values = Form.useWatch('lines', form) as ActualForm['lines'] | undefined;
  return (
    <Table
      rowKey="id"
      dataSource={order.lines}
      pagination={false}
      tableLayout="fixed"
      scroll={{ x: ACTUAL_TABLE_WIDTH }}
      data-testid="actual-lines"
      columns={[
        {
          title: text.product,
          width: 220,
          render: (_, line) => (
            <>
              <div>{line.productName}</div>
              <Typography.Text type="secondary">{line.productCode}</Typography.Text>
            </>
          ),
        },
        {
          title: text.planned,
          width: 180,
          render: (_, line) => `${line.plannedPackages} / ${tonnes(line.plannedWeightGrams)}`,
        },
        {
          title: text.scanned,
          width: 180,
          render: (_, line) => (
            <Typography.Text type="secondary">
              {line.scanPackages == null || line.scanPackages === 0
                ? text.notScanned
                : `${line.scanPackages} / ${tonnes(line.scanWeightGrams ?? 0)}`}
            </Typography.Text>
          ),
        },
        {
          title: text.packages,
          width: 160,
          render: (_, line, index) =>
            editable ? (
              <Form.Item name={['lines', index, 'actualPackages']} rules={[{ required: true, message: text.required }]}>
                <InputNumber
                  aria-label={`${text.packages} ${index + 1}`}
                  min={0}
                  max={OUTBOUND_ACTUAL_MAX_PACKAGES}
                  precision={0}
                />
              </Form.Item>
            ) : (
              line.actualPackages
            ),
        },
        {
          title: text.tonnes,
          width: 170,
          render: (_, line, index) =>
            editable ? (
              <Form.Item
                name={['lines', index, 'actualWeightTonnes']}
                rules={[{ required: true, message: text.required }]}
              >
                <InputNumber
                  aria-label={`${text.tonnes} ${index + 1}`}
                  min={0}
                  max={OUTBOUND_ACTUAL_MAX_GRAMS / 1_000_000}
                  precision={4}
                  step={0.0001}
                />
              </Form.Item>
            ) : (
              tonnes(line.actualWeightGrams)
            ),
        },
        {
          title: text.difference,
          width: 220,
          render: (_, line, index) => {
            const value = editable
              ? values?.[index]
              : { actualPackages: line.actualPackages, actualWeightTonnes: line.actualWeightGrams / 1_000_000 };
            if (value?.actualPackages == null || value.actualWeightTonnes == null) return '—';
            const packages = value.actualPackages - line.plannedPackages;
            const grams = Math.round(value.actualWeightTonnes * 1_000_000) - line.plannedWeightGrams;
            return (
              <span
                style={{
                  color:
                    packages > 0 || grams > 0
                      ? token.colorPrimary
                      : packages < 0 || grams < 0
                        ? token.colorWarning
                        : token.colorText,
                }}
              >
                {packages > 0 ? '+' : ''}
                {packages} 包 / {grams > 0 ? '+' : ''}
                {tonnes(grams)} 吨
              </span>
            );
          },
        },
      ]}
    />
  );
}
