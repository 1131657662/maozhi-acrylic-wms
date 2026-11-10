import { notifyError } from '../../api/error-events';
import { useFormErrors } from '../../components/use-form-errors';
import { DrawerForm, ProFormText } from '@ant-design/pro-components';
import { App, Button, Form, Typography } from 'antd';
import { createMasterItemSchema, hasGeneratedMasterCode, masterCreateSchema } from '@wms/contracts';
import type { MasterCatalog, MasterItem, CreateMasterItem } from '@wms/contracts';
import { useCreateMasterItem } from './use-create-master-item';
import { useUpdateMasterItem } from './use-update-master-item';
import { MasterExtraFields } from './extra-fields';
import { masterCopy as t, MASTER_DRAWER_SIZE } from './copy';

interface ItemEditorProps {
  catalog: MasterCatalog;
  editing: MasterItem | null;
  onClose: () => void;
  onSaved: (item: MasterItem) => void;
}

export function NewItemButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="primary" onClick={onClick}>
      {t.newItem}
    </Button>
  );
}

export function ItemEditor({ catalog, editing, onClose, onSaved }: ItemEditorProps) {
  const { message } = App.useApp();
  const create = useCreateMasterItem();
  const update = useUpdateMasterItem();
  const [form] = Form.useForm<CreateMasterItem>();
  useFormErrors(create.error ?? update.error, form);
  const generated = hasGeneratedMasterCode(catalog);
  async function save(values: CreateMasterItem): Promise<boolean> {
    try {
      const { code, ...fields } = createMasterItemSchema.strip().parse(values);
      const saved = editing
        ? await update.mutateAsync({ catalog, code: editing.code, ...fields })
        : await create.mutateAsync({
            catalog,
            ...masterCreateSchema(catalog).parse(generated ? fields : { code, ...fields }),
          });
      message.success(t.saved);
      onSaved(saved);
      return true;
    } catch (error) {
      notifyError(error);
      return false;
    }
  }
  return (
    <DrawerForm
      form={form}
      key={editing?.code ?? 'new'}
      title={editing ? `${editing.name} · ${t.edit}` : t.newItem}
      open
      width={MASTER_DRAWER_SIZE}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      initialValues={
        editing
          ? Object.fromEntries(
              Object.entries(editing).filter(([key]) =>
                [
                  'code',
                  'name',
                  ...(catalog === 'products'
                    ? [
                        'model',
                        'categoryCode',
                        'packageType',
                        'packageColor',
                        'strapColor',
                        'minAlertTonnes',
                        'maxAlertTonnes',
                        'memo',
                      ]
                    : catalog === 'warehouses'
                      ? ['contact', 'phone', 'address', 'memo']
                      : catalog === 'categories'
                        ? []
                        : ['memo']),
                ].includes(key),
              ),
            )
          : undefined
      }
      drawerProps={{ destroyOnHidden: true, onClose }}
      onFinish={save}
      submitter={{ searchConfig: { submitText: t.save, resetText: t.cancel }, onReset: onClose }}
    >
      {generated ? (
        <Form.Item label={t.code}>
          {editing ? (
            <Typography.Text copyable={{ text: editing.code, tooltips: [t.copyCode, t.copiedCode] }}>
              {editing.code}
            </Typography.Text>
          ) : (
            <Typography.Text type="secondary">{t.generatedCode}</Typography.Text>
          )}
        </Form.Item>
      ) : (
        <ProFormText name="code" label={t.code} rules={[{ required: true }]} disabled={Boolean(editing)} />
      )}
      {editing?.legacyCode && (
        <Form.Item label={t.legacyCode}>
          <Typography.Text>{editing.legacyCode}</Typography.Text>
        </Form.Item>
      )}
      <ProFormText name="name" label={t.name} rules={[{ required: true, whitespace: true }]} />
      <MasterExtraFields catalog={catalog} />
    </DrawerForm>
  );
}
