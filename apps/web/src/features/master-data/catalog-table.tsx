import { useState } from 'react';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { Alert, App, Popconfirm, Space, Tag, Button, Input } from 'antd';
import type { MasterCatalog, MasterItem } from '@wms/contracts';
import { useMasterItems } from './use-master-items';
import { useUpdateMasterItem } from './use-update-master-item';
import { ItemEditor, NewItemButton } from './item-editor';

export function CatalogTable({ catalog }: { catalog: MasterCatalog }) {
  const { message } = App.useApp();
  const [editing, setEditing] = useState<MasterItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState({ page: 1, pageSize: 20, keyword: '' });
  const { data, isLoading, error, refetch } = useMasterItems(catalog, query);
  const update = useUpdateMasterItem();
  const columns: ProColumns<MasterItem>[] = [
    { title: '编码', dataIndex: 'code', width: 180 },
    { title: '名称', dataIndex: 'name' },
    {
      title: '状态',
      dataIndex: 'active',
      width: 100,
      render: (_, row) => (row.active ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 180,
      render: (_, row) => (
        <Space>
          <Button type="link" onClick={() => setEditing(row)}>
            编辑
          </Button>
          <Popconfirm
            title={`确认${row.active ? '停用' : '启用'} ${row.name}？`}
            onConfirm={async () => {
              try {
                await update.mutateAsync({ catalog, code: row.code, active: !row.active });
              } catch (reason) {
                message.error(reason instanceof Error ? reason.message : '状态更新失败');
              }
            }}
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
      {catalog === 'products' && <Alert type="info" showIcon title="商品由 ERP 维护，此处只读" />}
      <Input.Search
        aria-label="搜索主数据"
        placeholder="按编码或名称搜索"
        allowClear
        onSearch={(keyword) => setQuery({ ...query, keyword, page: 1 })}
      />
      {error && (
        <Alert type="error" title={error.message} action={<Button onClick={() => void refetch()}>重试</Button>} />
      )}
      <ProTable<MasterItem>
        rowKey="code"
        columns={catalog === 'products' ? columns.filter((column) => column.valueType !== 'option') : columns}
        dataSource={error ? [] : data?.items}
        loading={isLoading}
        search={false}
        options={false}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: data?.total ?? 0,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100, 200],
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => setQuery({ ...query, page: pageSize === query.pageSize ? page : 1, pageSize }),
        }}
        toolbar={{
          title: '主数据目录',
          actions: catalog === 'products' ? [] : [<NewItemButton key="new" onClick={() => setCreating(true)} />],
        }}
        locale={{ emptyText: '暂无主数据' }}
      />
      {catalog !== 'products' && (creating || editing) && (
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
    </>
  );
}
