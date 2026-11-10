import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { Button, Select, Space } from 'antd';
import type { MasterCatalog } from '@wms/contracts';
import { hasGeneratedMasterCode } from '@wms/contracts';
import { MasterLabel } from './master-label';
import { useMasterItems } from './use-master-items';
import { useMasterItem } from './use-master-item';
import { ItemEditor } from './item-editor';
import { masterCopy as t, MASTER_PAGE_SIZE } from './copy';

interface Props {
  catalog: MasterCatalog;
  id?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  disabled?: boolean;
}
export function MasterSelect({ catalog, ...props }: Props) {
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState({ keyword: '', page: 1 });
  const {
    data: page,
    isFetching: loading,
    error,
    refetch,
  } = useMasterItems(catalog, {
    ...query,
    pageSize: MASTER_PAGE_SIZE,
    status: 'active',
    ...(catalog === 'products' ? { scope: 'inventory' as const } : {}),
  });
  const { data: selected, error: selectedError } = useMasterItem(catalog, props.value);
  const rows = new Map([...(selected ? [selected] : []), ...(page?.items ?? [])].map((item) => [item.code, item]));
  const options = [...rows.values()].map((item) => ({
    value: item.code,
    label: `${hasGeneratedMasterCode(catalog) ? `${item.name} · ${item.code}` : `${item.code} · ${item.name}`}${item.active ? '' : '（已停用）'}`,
    disabled: !item.active || (catalog === 'products' && !item.inventoryEligible),
  }));
  if (props.value && !rows.has(props.value))
    options.push({
      value: props.value,
      label: `${props.value} · ${selectedError ? '资料不可用' : '加载中'}`,
      disabled: true,
    });
  return (
    <>
      <Select<string>
        {...props}
        allowClear
        loading={loading}
        options={options}
        optionRender={(option) => {
          const item = rows.get(String(option.value));
          return item && hasGeneratedMasterCode(catalog) ? <MasterLabel item={item} /> : option.label;
        }}
        labelRender={(option) => {
          const item = rows.get(String(option.value));
          return item && hasGeneratedMasterCode(catalog) ? <MasterLabel item={item} /> : option.label;
        }}
        showSearch={{ filterOption: false, onSearch: (keyword) => setQuery({ keyword, page: 1 }) }}
        placeholder="输入编码或名称搜索"
        notFoundContent={error ? '加载失败，请重试' : loading ? '加载中' : '没有匹配资料'}
        popupRender={(menu) => (
          <>
            {menu}
            {error && (
              <RequestError type="error" error={error} action={<Button onClick={() => void refetch()}>重试</Button>} />
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
                {query.page} / {Math.max(1, Math.ceil((page?.total ?? 0) / MASTER_PAGE_SIZE))}
              </span>
              <Button
                size="small"
                disabled={!page || query.page * MASTER_PAGE_SIZE >= page.total || loading}
                onClick={() => setQuery({ ...query, page: query.page + 1 })}
              >
                下一页资料
              </Button>
            </Space>
          </>
        )}
      />
      {!props.disabled && (
        <Button type="link" onClick={() => setCreating(true)}>
          {t.newItem}
        </Button>
      )}
      {creating && (
        <ItemEditor
          catalog={catalog}
          editing={null}
          onClose={() => setCreating(false)}
          onSaved={(item) => {
            setCreating(false);
            props.onChange?.(item.code);
          }}
        />
      )}
    </>
  );
}
