import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Form, Select, Space, Typography } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import type { PartyOwner } from '@wms/contracts';
import { contactKeys } from './contact-keys';
import { ContactDrawer } from './contact-drawer';
import { MasterSelect } from './select';
import { masterCopy as t } from './copy';
export function PartyFields({ partyType }: { partyType: PartyOwner['partyType'] }) {
  const form = Form.useFormInstance(),
    field = partyType === 'customer' ? 'customerCode' : 'supplierCode';
  const code = Form.useWatch<string | undefined>(field, form);
  return (
    <>
      <ProForm.Item name={field} label={partyType === 'customer' ? '客户' : '供应商'} rules={[{ required: true }]}>
        <MasterSelect
          catalog={partyType === 'customer' ? 'customers' : 'suppliers'}
          onChange={() => form.setFieldValue('contactId', undefined)}
        />
      </ProForm.Item>
      {code && (
        <ProForm.Item name="contactId" label={partyType === 'customer' ? t.receiver : t.deliverer}>
          <ContactPicker key={`${partyType}:${code}`} owner={{ partyType, partyCode: code }} />
        </ProForm.Item>
      )}
    </>
  );
}
function ContactPicker({
  owner,
  value,
  onChange,
}: {
  owner: PartyOwner;
  value?: string | null;
  onChange?: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false),
    { data: contacts, isLoading: loading, error } = useQuery(contactKeys.list(owner));
  const selectedId = value === undefined ? contacts?.suggestedId : value;
  const selected = contacts?.items.find((item) => item.id === selectedId);
  return (
    <>
      <Space.Compact block>
        <Select
          style={{ width: '100%' }}
          aria-label={owner.partyType === 'customer' ? t.receiver : t.deliverer}
          value={selectedId ?? undefined}
          allowClear
          loading={loading}
          onChange={(next) => onChange?.(next ?? null)}
          placeholder={t.defaultHint}
          options={contacts?.items
            .filter((item) => item.active)
            .map((item) => ({ value: item.id, label: `${item.name} ${item.phone ?? ''}` }))}
        />
        <Button onClick={() => setOpen(true)}>{t.manage}</Button>
      </Space.Compact>
      {selected && (
        <Typography.Text type="secondary">
          {selected.phone} {selected.address}
        </Typography.Text>
      )}
      {error && <Alert type="error" title={error.message} />}
      {open && <ContactDrawer owner={owner} onClose={() => setOpen(false)} />}
    </>
  );
}
