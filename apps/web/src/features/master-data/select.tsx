import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { Button, Select } from 'antd';
import type { MasterCatalog } from '@wms/contracts';
import { MasterLabel } from './master-label';
import { useMasterItems } from './use-master-items';
import { useMasterItem } from './use-master-item';
import { ItemEditor } from './item-editor';
import { masterCopy as t, masterSearchCopy as searchText, MASTER_PAGE_SIZE } from './copy';
import { useMasterSearch } from './use-master-search';
import { SearchFeedback } from './search-feedback';
import { SearchPagination } from './search-pagination';
import { MasterOptionLabel } from './option-label';

interface Props {
  catalog: MasterCatalog;
  id?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  disabled?: boolean;
}
export function MasterSelect({ catalog, ...props }: Props) {
  const [creating, setCreating] = useState(false);
  const search = useMasterSearch();
  const {
    data: page,
    isFetching,
    error,
    refetch,
  } = useMasterItems(
    catalog,
    {
      ...search.query,
      pageSize: MASTER_PAGE_SIZE,
      status: 'active',
      ...(catalog === 'products' ? { scope: 'inventory' as const } : {}),
    },
    search.enabled && !props.disabled,
  );
  const { data: selected, error: selectedError } = useMasterItem(catalog, props.value);
  const loading = search.pending || (search.enabled && isFetching);
  const candidates =
    search.enabled && !loading
      ? (page?.items ?? []).filter((item) => item.active && (catalog !== 'products' || item.inventoryEligible))
      : [];
  const rows = new Map([...(selected ? [selected] : []), ...candidates].map((item) => [item.code, item]));
  const options = candidates.map((item) => ({
    value: item.code,
    label: `${item.name} · ${item.code}`,
  }));
  return (
    <>
      <Select<string>
        {...props}
        allowClear
        loading={loading}
        options={options}
        optionRender={(option) => {
          const item = rows.get(String(option.value));
          return item ? <MasterOptionLabel item={item} /> : option.label;
        }}
        labelRender={(option) => {
          const item = rows.get(String(option.value));
          return item ? (
            <span title={`${item.name} · ${item.code}`}>
              <MasterLabel item={item} />
            </span>
          ) : (
            `${option.value} · ${selectedError ? searchText.unavailable : searchText.selectedLoading}`
          );
        }}
        showSearch={{ filterOption: false, onSearch: search.onSearch }}
        placeholder={searchText.placeholder}
        notFoundContent={
          <SearchFeedback catalog={catalog} loading={loading} hasInput={search.hasInput} error={error} />
        }
        popupRender={(menu) => (
          <>
            {menu}
            {search.enabled && error && (
              <RequestError
                type="error"
                error={error}
                action={
                  <Button
                    aria-label={t.retry}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => void refetch()}
                  >
                    {t.retry}
                  </Button>
                }
              />
            )}
            <SearchPagination
              page={search.query.page}
              total={page?.total ?? 0}
              disabled={!search.enabled || loading || !!error}
              onChange={search.changePage}
            />
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
