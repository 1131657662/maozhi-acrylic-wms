import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { Form } from 'antd';
import { useFormDraft } from '../../components/form-protection/use-form-draft';
import { useFormErrors } from '../../components/use-form-errors';
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
  const [form] = Form.useForm();
  const draft = useFormDraft(form, `contact-${owner.partyType}-${owner.partyCode}`, editing?.id ?? 'new');
  const lock = useSubmitLock();
  useFormErrors(create.error ?? update.error, form);
  return (
    <DrawerForm<{ name: string; phone?: string; address?: string }>
      form={form}
      disabled={lock.busy}
      onValuesChange={draft.change}
      open
      title={editing ? t.edit : t.newContact}
      width={MASTER_DRAWER_SIZE}
      drawerProps={{ destroyOnHidden: true, onClose: () => void draft.leave(onClose) }}
      onOpenChange={(open) => {
        if (!open) void draft.leave(onClose);
      }}
      initialValues={editing ? { name: editing.name, phone: editing.phone, address: editing.address } : undefined}
      submitter={{
        submitButtonProps: lock.button,
        searchConfig: { submitText: lock.text(t.save), resetText: t.cancel },
      }}
      onFinish={(values) =>
        lock.run(async () => {
          try {
            if (editing) await update.mutateAsync({ id: editing.id, ...values });
            else await create.mutateAsync({ ...owner, ...values });
            draft.saved();
            onClose();
            return false; // The controlled drawer is already closed by its owner.
          } catch (error) {
            notifyError(error);
            return false;
          }
        })
      }
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
