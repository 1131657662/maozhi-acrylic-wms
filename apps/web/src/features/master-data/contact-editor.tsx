import { notifyError } from '../../api/error-events';
import { DrawerForm, ProFormText } from '@ant-design/pro-components';
import type { Contact, PartyOwner } from '@wms/contracts';
import { useCreateContact } from './use-create-contact';
import { useUpdateContact } from './use-update-contact';
import { masterCopy as t, MASTER_DRAWER_SIZE } from './copy';
export function ContactEditor({
  owner,
  editing,
  onClose,
}: {
  owner: PartyOwner;
  editing: Contact | null;
  onClose: () => void;
}) {
  const create = useCreateContact(),
    update = useUpdateContact();
  return (
    <DrawerForm<{ name: string; phone?: string; address?: string }>
      open
      title={editing ? t.edit : t.newContact}
      width={MASTER_DRAWER_SIZE}
      drawerProps={{ destroyOnHidden: true, onClose }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      initialValues={editing ? { name: editing.name, phone: editing.phone, address: editing.address } : undefined}
      submitter={{ searchConfig: { submitText: t.save, resetText: t.cancel } }}
      onFinish={async (values) => {
        try {
          if (editing) await update.mutateAsync({ id: editing.id, ...values });
          else await create.mutateAsync({ ...owner, ...values });
          onClose();
          return true;
        } catch (error) {
          notifyError(error);
          return false;
        }
      }}
    >
      <ProFormText
        name="name"
        label={t.contact}
        rules={[{ required: true, whitespace: true }]}
        fieldProps={{ maxLength: 100 }}
      />
      <ProFormText name="phone" label={t.phone} fieldProps={{ maxLength: 50 }} />
      <ProFormText name="address" label={t.address} fieldProps={{ maxLength: 500 }} />
    </DrawerForm>
  );
}
