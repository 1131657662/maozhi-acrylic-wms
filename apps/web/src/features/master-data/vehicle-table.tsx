import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Input, Popconfirm, Space } from 'antd';
import { ProTable } from '@ant-design/pro-components';
import type { Vehicle } from '@wms/contracts';
import { vehicleKeys } from './vehicle-keys';
import { useUpdateVehicle } from './use-update-vehicle';
import { VehicleEditor } from './vehicle-editor';
import { masterCopy as t, MASTER_PAGE_SIZE, MASTER_PAGE_SIZES } from './copy';
export function VehicleTable() {
  const [query, setQuery] = useState({ page: 1, pageSize: MASTER_PAGE_SIZE, keyword: '' }),
    [editor, setEditor] = useState<{ item: Vehicle | null } | null>(null);
  const { data: vehicles, isLoading: loading, error } = useQuery(vehicleKeys.list(query)),
    update = useUpdateVehicle(),
    { message } = App.useApp();
  return (
    <>
      <Input.Search
        aria-label={t.plate}
        placeholder={t.plate}
        allowClear
        onSearch={(keyword) => setQuery({ ...query, keyword, page: 1 })}
      />
      {error && <Alert type="error" title={error.message} />}
      <ProTable<Vehicle>
        rowKey="id"
        dataSource={vehicles?.items}
        loading={loading}
        search={false}
        options={false}
        toolbar={{
          title: t.vehicles,
          actions: [
            <Button key="new" type="primary" onClick={() => setEditor({ item: null })}>
              {t.newVehicle}
            </Button>,
          ],
        }}
        pagination={{
          current: query.page,
          pageSize: query.pageSize,
          total: vehicles?.total,
          pageSizeOptions: MASTER_PAGE_SIZES,
          onChange: (page, pageSize) => setQuery({ ...query, page, pageSize }),
        }}
        columns={[
          { title: t.plate, dataIndex: 'plate' },
          { title: t.driver, dataIndex: 'driver' },
          { title: t.phone, dataIndex: 'phone' },
          { title: t.source, render: (_, row) => t.vehicleSource[row.source] },
          { title: t.useCount, dataIndex: 'useCount' },
          {
            title: t.edit,
            valueType: 'option',
            render: (_, row) => (
              <Space>
                <Button type="link" onClick={() => setEditor({ item: row })}>
                  {t.edit}
                </Button>
                <Popconfirm
                  title={row.active ? t.confirmDisable : t.confirmEnable}
                  onConfirm={async () => {
                    try {
                      await update.mutateAsync({ id: row.id, active: !row.active });
                    } catch (error) {
                      message.error(error instanceof Error ? error.message : t.failed);
                    }
                  }}
                >
                  <Button type="link">{row.active ? t.inactive : t.active}</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      {editor && <VehicleEditor editing={editor.item} onClose={() => setEditor(null)} />}
    </>
  );
}
