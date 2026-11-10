import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AutoComplete } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { vehicleKeys } from './vehicle-keys';
import { masterCopy as t, MASTER_PAGE_SIZE } from './copy';
export function VehicleField() {
  return (
    <ProForm.Item name="vehicleNo" label={t.plate} rules={[{ required: true, whitespace: true }]}>
      <VehicleInput />
    </ProForm.Item>
  );
}
function VehicleInput(props: { value?: string; onChange?: (value: string) => void; id?: string }) {
  const [keyword, setKeyword] = useState(''),
    { data: vehicles } = useQuery(vehicleKeys.list({ keyword, page: 1, pageSize: MASTER_PAGE_SIZE, status: 'active' }));
  return (
    <AutoComplete
      {...props}
      onChange={(value) => {
        setKeyword(value);
        props.onChange?.(value);
      }}
      options={vehicles?.items.map((row) => ({ value: row.plate }))}
      maxLength={100}
    />
  );
}
