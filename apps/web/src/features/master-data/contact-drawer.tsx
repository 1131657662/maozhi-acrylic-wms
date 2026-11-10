import { notifyError } from '../../api/error-events';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Drawer, Popconfirm, Radio, Space, Table } from 'antd';
import type { Contact, PartyOwner } from '@wms/contracts';
import { contactKeys } from './contact-keys';
import { useSetDefaultContact } from './use-set-default-contact';
import { useUpdateContact } from './use-update-contact';
import { ContactEditor } from './contact-editor';
import { masterCopy as t, MASTER_DRAWER_SIZE, MASTER_PAGE_SIZE } from './copy';
export function ContactDrawer({ owner, onClose }: { owner: PartyOwner; onClose: () => void }) {
  const { data: contacts, isLoading: loading, error } = useQuery(contactKeys.list(owner));
  const [editor, setEditor] = useState<{ item: Contact | null } | null>(null),
    setDefault = useSetDefaultContact(),
    update = useUpdateContact();
  const report = (error: unknown) => notifyError(error);
  return (
    <Drawer
      open
      title={t.contacts}
      size={MASTER_DRAWER_SIZE}
      onClose={onClose}
      extra={<Button onClick={onClose}>{t.complete}</Button>}
    >
      {error && <RequestError type="error" error={error} />}
      <Table<Contact>
        rowKey="id"
        loading={loading}
        dataSource={contacts?.items}
        pagination={{ pageSize: MASTER_PAGE_SIZE }}
        columns={[
          {
            title: t.defaultContact,
            render: (_, row) => (
              <Radio
                aria-label={`${t.defaultContact} ${row.name}`}
                checked={row.isDefault}
                disabled={!row.active || setDefault.isPending}
                onChange={() => setDefault.mutate(row.id, { onError: report })}
              />
            ),
          },
          { title: t.contact, dataIndex: 'name' },
          { title: t.phone, dataIndex: 'phone' },
          { title: t.address, dataIndex: 'address' },
          {
            title: t.edit,
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => setEditor({ item: row })}>
                  {t.edit}
                </Button>
                <Popconfirm
                  title={row.active ? t.confirmDisable : t.confirmEnable}
                  onConfirm={() => update.mutateAsync({ id: row.id, active: !row.active }).catch(report)}
                >
                  <Button type="link" disabled={update.isPending}>
                    {row.active ? t.inactive : t.active}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Button type="primary" onClick={() => setEditor({ item: null })}>
        {t.newContact}
      </Button>
      {editor && <ContactEditor owner={owner} editing={editor.item} onClose={() => setEditor(null)} />}
    </Drawer>
  );
}
