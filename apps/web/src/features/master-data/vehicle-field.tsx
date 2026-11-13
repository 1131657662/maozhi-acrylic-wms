import { useQuery } from '@tanstack/react-query';
import { AutoComplete, Button, Spin } from 'antd';
import { ProForm } from '@ant-design/pro-components';
import { vehicleKeys } from './vehicle-keys';
import { masterCopy as t, masterSearchCopy, MASTER_PAGE_SIZE, MASTER_SEARCH } from './copy';
import { useMasterSearch } from './use-master-search';
import { SearchFeedback } from './search-feedback';
import { SearchPagination } from './search-pagination';
import { RequestError } from '../../components/RequestError';
export function VehicleField() {
  return (
    <ProForm.Item name="vehicleNo" label={t.plate} rules={[{ required: true, whitespace: true }]}>
      <VehicleInput />
    </ProForm.Item>
  );
}
function VehicleInput(props: { value?: string; onChange?: (value: string) => void; id?: string }) {
  const search = useMasterSearch();
  const {
    data: vehicles,
    isFetching,
    error,
    refetch,
  } = useQuery({
    ...vehicleKeys.list({ ...search.query, pageSize: MASTER_PAGE_SIZE, status: 'active' }),
    enabled: search.enabled,
  });
  const loading = search.pending || (search.enabled && isFetching);
  const options =
    search.enabled && !loading ? vehicles?.items.filter((row) => row.active).map((row) => ({ value: row.plate })) : [];
  return (
    <AutoComplete
      {...props}
      showSearch={{ filterOption: false, onSearch: search.onSearch }}
      options={options}
      placeholder={masterSearchCopy.vehiclePlaceholder}
      suffix={loading ? <Spin size="small" /> : null}
      notFoundContent={<SearchFeedback catalog="vehicles" loading={loading} hasInput={search.hasInput} error={error} />}
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
            total={vehicles?.total ?? 0}
            disabled={!search.enabled || loading || !!error}
            onChange={search.changePage}
          />
        </>
      )}
      maxLength={MASTER_SEARCH.vehicleMaxLength}
    />
  );
}
