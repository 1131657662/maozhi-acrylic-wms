import { useState } from 'react';
import { Alert, App, Button, Flex, Form } from 'antd';
import type { ActualQuantity, ShipmentList } from '@wms/contracts';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { tonnesDeltaToGrams } from '../../lib/weight-input';
import { ActualLines, type ActualForm } from './actual-lines';
import { ShipmentDialog } from './shipment-dialog';
import { shipmentCopy as text, SHIPMENT_UI as ui } from './shipment-copy';

interface Props {
  id: string;
  snapshot: ShipmentList;
  close: () => void;
}
export function ShipmentEntry({ id, snapshot, close }: Props) {
  const [form] = Form.useForm<ActualForm>();
  const draft = useFormDraft(form, 'outbound-shipment', `${id}:${snapshot.revision}`);
  const [review, setReview] = useState<ActualQuantity[] | null>(null);
  const { message } = App.useApp();
  function ask() {
    const values = form.getFieldsValue();
    const lines = snapshot.lines.map((line, index) => ({
      lineId: line.lineId,
      actualPackages: values.lines?.[index]?.actualPackages ?? 0,
      actualWeightGrams: tonnesDeltaToGrams(values.lines?.[index]?.actualWeightTonnes ?? 0),
    }));
    if (lines.every((line) => !line.actualPackages && !line.actualWeightGrams)) {
      void message.warning(text.allZero);
      return;
    }
    setReview(lines);
  }
  return (
    <Form
      form={form}
      onValuesChange={draft.change}
      initialValues={{
        lines: snapshot.lines.map((line) => ({
          actualPackages: line.prefillPackages,
          actualWeightTonnes: line.prefillWeightGrams == null ? null : line.prefillWeightGrams / ui.gramsPerTonne,
        })),
      }}
    >
      <Flex vertical gap="middle">
        <Alert type="info" title={text.inputHint} description={text.differenceHint} />
        <ActualLines lines={snapshot.lines} form={form} />
        <Flex justify="end" gap="small">
          <Button onClick={() => void draft.leave(close)}>{text.leave}</Button>
          <Button type="primary" onClick={ask}>
            {text.review}
          </Button>
        </Flex>
      </Flex>
      <ShipmentDialog
        open={review !== null}
        id={id}
        data={snapshot}
        lines={review ?? []}
        close={() => setReview(null)}
        saved={() => {
          draft.saved();
          close();
        }}
      />
    </Form>
  );
}
