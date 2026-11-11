import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { businessCopy } from '../../business-copy';
import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Popconfirm, Space, Tag, Button, Input } from 'antd';
import type { MasterCatalog, MasterItem } from '@wms/contracts';
import { MasterLabel } from './master-label';
import { useMasterItems } from './use-master-items';
import { useUpdateMasterItem } from './use-update-master-item';
import { ContactDrawer } from './contact-drawer';
import { masterCopy as t, MASTER_PAGE_SIZE, MASTER_PAGE_SIZES } from './copy';
import { ApiError } from '../../api/client';
import { z } from 'zod';
import { ItemEditor, NewItemButton } from './item-editor';

export function CatalogTable({ catalog }: { catalog: MasterCatalog }) {
  const [contactOwner, setContactOwner] = useState<string | null>(null);
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState({ page: 1, pageSize: MASTER_PAGE_SIZE, keyword: '' });
  const { data, isLoading, error, refetch } = useMasterItems(catalog, query);
  const update = useUpdateMasterItem();
  const lock = useSubmitLock();
  const references =
    update.error instanceof ApiError
      ? z.object({ references: z.array(z.object({ documentNo: z.string() })) }).safeParse(update.error.data)
      : null;
  const columns: ProColumns<MasterItem>[] = [
    { title: t.name, dataIndex: 'name', render: (_, row) => <MasterLabel item={row} /> },
    ...(catalog === 'products'
      ? [
          { title: t.source, render: (_: unknown, row: MasterItem) => t.origin[row.originKind ?? 'unknown'] },
          {
            title: t.eligibility,
            render: (_: unknown, row: MasterItem) => (row.inventoryEligible ? t.eligible : t.ineligible),
          },
        ]
      : []),
    {
      title: '状态',
      dataIndex: 'active',
      width: 100,
      render: (_, row) => (row.active ? <Tag color="success">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, row) => (
        <Space>
          {(catalog === 'customers' || catalog === 'suppliers') && (
            <Button type="link" onClick={() => setContactOwner(row.code)}>
              {t.contacts}
            </Button>
          )}
          <Button type="link" onClick={() => setEditing(row)}>
            编辑
          </Button>
          <Popconfirm
            title={`确认${row.active ? '停用' : '启用'} ${row.name}？`}
            okText={lock.text(t.confirm)}
            okButtonProps={lock.button}
            onConfirm={() =>
              lock.run(async () => {
                try {
                  await update.mutateAsync({ catalog, code: row.code, active: !row.active });
                } catch {
                  /* RequestError retains the failure and related documents below. */
                }
              })
            }
          >
            <Button type="link" loading={update.isPending}>
              {row.active ? '停用' : '启用'}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
  return (
    <>
      <Input.Search
        aria-label={businessCopy.masterDataCatalogTable1}
        placeholder="按编码或名称搜索"
        allowClear
        onSearch={(keyword) => setQuery({ ...query, keyword, page: 1 })}
      />
      {error && (
        <RequestError type="error" error={error} action={<Button onClick={() => void refetch()}>重试</Button>} />
      )}
      {update.error && (
        <RequestError
          error={update.error}
          description={
            references?.success ? references.data.references.map((row) => row.documentNo).join('、') : undefined
          }
        />
      )}
      <ProTable<MasterItem>
        rowKey="code"
        columns={columns}
        dataSource={error ? [] : data?.items}
        loading={isLoading}
        search={false}
        options={false}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: MASTER_PAGE_SIZES,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setQuery({ ...query, page: pageSize === query.pageSize ? page : 1, pageSize }),
        }}
        toolbar={{
          title: businessCopy.masterDataCatalogTable2,
          actions: [<NewItemButton key="new" onClick={() => setCreating(true)} />],
        }}
        locale={{ emptyText: businessCopy.masterDataCatalogTable3 }}
      />
      {(creating || editing) && (
        <ItemEditor
          catalog={catalog}
          editing={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
      {contactOwner && (
        <ContactDrawer
          owner={{ partyType: catalog === 'customers' ? 'customer' : 'supplier', partyCode: contactOwner }}
          onClose={() => setContactOwner(null)}
        />
      )}
    </>
  );
}
