import { DrawerForm, ProFormText } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import { createMasterItemSchema } from '@wms/contracts';
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
  async function save(values: CreateMasterItem): Promise<boolean> {
    try {
      const { code, ...fields } = createMasterItemSchema.strip().parse(values);
      const saved = editing
        ? await update.mutateAsync({ catalog, code: editing.code, ...fields })
        : await create.mutateAsync({ catalog, code, ...fields });
      message.success(t.saved);
      onSaved(saved);
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : t.failed);
      return false;
    }
  }
  return (
    <DrawerForm
      key={editing?.code ?? 'new'}
      title={editing ? t.edit : t.newItem}
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
      <ProFormText name="code" label="编码" rules={[{ required: true }]} disabled={Boolean(editing)} />
      <ProFormText name="name" label="名称" rules={[{ required: true, whitespace: true }]} />
      <MasterExtraFields catalog={catalog} />
    </DrawerForm>
  );
}
