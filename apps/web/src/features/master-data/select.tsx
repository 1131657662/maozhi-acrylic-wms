import { useState } from 'react';
import { Button, Select, Space, Alert } from 'antd';
import type { MasterCatalog } from '@wms/contracts';
import { useMasterItems } from './use-master-items';
import { useMasterItem } from './use-master-item';

interface Props {
  catalog: MasterCatalog;
  id?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  disabled?: boolean;
}
export function MasterSelect({ catalog, ...props }: Props) {
  const [query, setQuery] = useState({ keyword: '', page: 1 });
  const {
    data: page,
    isFetching: loading,
    error,
    refetch,
  } = useMasterItems(catalog, { ...query, pageSize: 20, status: 'active' });
  const { data: selected, error: selectedError } = useMasterItem(catalog, props.value);
  const rows = new Map([...(selected ? [selected] : []), ...(page?.items ?? [])].map((item) => [item.code, item]));
  const options = [...rows.values()].map((item) => ({
    value: item.code,
    label: `${item.code} · ${item.name}${item.active ? '' : '（已停用）'}`,
    disabled: !item.active,
  }));
  if (props.value && !rows.has(props.value))
    options.push({
      value: props.value,
      label: `${props.value} · ${selectedError ? '资料不可用' : '加载中'}`,
      disabled: true,
    });
  return (
    <Select<string>
      {...props}
      allowClear
      loading={loading}
      options={options}
      showSearch={{ filterOption: false, onSearch: (keyword) => setQuery({ keyword, page: 1 }) }}
      placeholder="输入编码或名称搜索"
      notFoundContent={error ? '加载失败，请重试' : loading ? '加载中' : '没有匹配资料'}
      popupRender={(menu) => (
        <>
          {menu}
          {error && (
            <Alert type="error" title={error.message} action={<Button onClick={() => void refetch()}>重试</Button>} />
          )}
          <Space onMouseDown={(event) => event.preventDefault()}>
            <Button
              size="small"
              disabled={query.page <= 1 || loading}
              onClick={() => setQuery({ ...query, page: query.page - 1 })}
            >
              上一页资料
            </Button>
            <span>
              {query.page} / {Math.max(1, Math.ceil((page?.total ?? 0) / 20))}
            </span>
            <Button
              size="small"
              disabled={!page || query.page * 20 >= page.total || loading}
              onClick={() => setQuery({ ...query, page: query.page + 1 })}
            >
              下一页资料
            </Button>
          </Space>
        </>
      )}
    />
  );
}
