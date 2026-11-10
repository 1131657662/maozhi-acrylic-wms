import { notifyError } from '../../api/error-events';
import { DrawerForm, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { createVehicleSchema, type Vehicle } from '@wms/contracts';
import type { z } from 'zod';
import { useCreateVehicle } from './use-create-vehicle';
import { useUpdateVehicle } from './use-update-vehicle';
import { masterCopy as t, MASTER_DRAWER_SIZE } from './copy';
export function VehicleEditor({ editing, onClose }: { editing: Vehicle | null; onClose: () => void }) {
  const create = useCreateVehicle(),
    update = useUpdateVehicle();
  return (
    <DrawerForm<z.infer<typeof createVehicleSchema>>
      open
      title={editing ? t.edit : t.newVehicle}
      width={MASTER_DRAWER_SIZE}
      drawerProps={{ destroyOnHidden: true, onClose }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      initialValues={
        editing ? { plate: editing.plate, driver: editing.driver, phone: editing.phone, memo: editing.memo } : undefined
      }
      submitter={{ searchConfig: { submitText: t.save, resetText: t.cancel } }}
      onFinish={async (values) => {
        try {
          const { plate, ...fields } = values;
          if (editing) await update.mutateAsync({ id: editing.id, ...fields });
          else await create.mutateAsync(values);
          onClose();
          return true;
        } catch (error) {
          notifyError(error);
          return false;
        }
      }}
    >
      <ProFormText
        name="plate"
        label={t.plate}
        disabled={Boolean(editing)}
        rules={[{ required: true, whitespace: true }]}
        fieldProps={{ maxLength: 100 }}
      />
      <ProFormText name="driver" label={t.driver} fieldProps={{ maxLength: 100 }} />
      <ProFormText name="phone" label={t.phone} fieldProps={{ maxLength: 50 }} />
      <ProFormTextArea name="memo" label={t.memo} fieldProps={{ maxLength: 500 }} />
    </DrawerForm>
  );
}
