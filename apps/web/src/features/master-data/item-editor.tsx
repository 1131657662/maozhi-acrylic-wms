import { useState } from 'react';
import { ModalForm, ProFormText } from '@ant-design/pro-components';
import { App, Button } from 'antd';
import type { MasterCatalog, MasterItem } from '@wms/contracts';
import { useCreateMasterItem } from './use-create-master-item';
import { useUpdateMasterItem } from './use-update-master-item';

interface ItemEditorProps {
  catalog: MasterCatalog;
  editing: MasterItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function NewItemButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="primary" onClick={onClick}>
      新增主数据
    </Button>
  );
}

export function ItemEditor({ catalog, editing, onClose, onSaved }: ItemEditorProps) {
  const { message } = App.useApp();
  const create = useCreateMasterItem();
  const update = useUpdateMasterItem();
  const [open, setOpen] = useState(true);
  async function save(values: { code: string; name: string }): Promise<boolean> {
    try {
      if (editing) await update.mutateAsync({ catalog, code: editing.code, name: values.name });
      else await create.mutateAsync({ catalog, code: values.code, name: values.name });
      message.success(editing ? '主数据已更新' : '主数据已创建');
      onSaved();
      return true;
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
      return false;
    }
  }
  return (
    <ModalForm
      key={editing?.code ?? 'new'}
      title={editing ? '编辑主数据' : '新增主数据'}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      initialValues={editing ?? undefined}
      modalProps={{ destroyOnHidden: true, onCancel: onClose }}
      onFinish={save}
      submitter={{ searchConfig: { submitText: '保存', resetText: '取消' }, onReset: onClose }}
    >
      <ProFormText name="code" label="编码" rules={[{ required: true }]} disabled={Boolean(editing)} />
      <ProFormText name="name" label="名称" rules={[{ required: true, whitespace: true }]} />
    </ModalForm>
  );
}
