import type { ReactNode } from 'react';
import { QueryFilter, ProFormDateRangePicker, ProFormText } from '@ant-design/pro-components';
import type { ListParams } from '../../features/web-lists/keys';
import type { ListState } from './use-list-state';

function filterValues(params: ListParams): Record<string, unknown> {
  const date = (value: string) => new Date(value).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  const names = [
    'keyword',
    'supplier',
    'customer',
    'warehouse',
    'vehicle',
    'postingState',
    'product',
    'action',
    'target',
    'traceId',
  ];
  const fields = Object.fromEntries(names.map((name) => [name, params[name]]));
  return {
    ...fields,
    statusChoice: params.statusMissing
      ? 'null'
      : params.status !== undefined
        ? JSON.stringify(params.status)
        : undefined,
    dateRange: params.from && params.to ? [date(params.from), date(params.to)] : undefined,
  };
}
function toParams(values: Record<string, unknown>): ListParams {
  const { dateRange, statusChoice, ...fields } = values;
  const result: ListParams = Object.fromEntries(
    Object.entries(fields)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim() !== '')
      .map(([key, value]) => [key, value.trim()]),
  );
  if (Array.isArray(dateRange) && dateRange.length === 2 && dateRange.every((date) => typeof date === 'string')) {
    result.from = `${dateRange[0]}T00:00:00+08:00`;
    result.to = `${dateRange[1]}T23:59:59.999+08:00`;
  }
  if (statusChoice === 'null') result.statusMissing = 'true';
  else if (typeof statusChoice === 'string') result.status = String(JSON.parse(statusChoice));
  return result;
}
export function ListFilters({ state, children }: { state: ListState; children: ReactNode }) {
  return (
    <QueryFilter<Record<string, unknown>>
      key={JSON.stringify(filterValues(state.params))}
      initialValues={filterValues(state.params)}
      labelWidth="auto"
      span={{ xs: 24, sm: 12, md: 12, lg: 8, xl: 8, xxl: 6 }}
      defaultCollapsed
      onFinish={async (values) => {
        state.searchFor(toParams(values));
        return true;
      }}
      onReset={state.reset}
      dateFormatter="string"
      searchText="查询"
      resetText="重置"
      submitter={{ submitButtonProps: { type: 'default' } }}
    >
      {children}
    </QueryFilter>
  );
}
export function ListDateFilter({ label, hidden }: { label: string; hidden?: boolean }) {
  return <ProFormDateRangePicker name="dateRange" label={label} hidden={hidden} fieldProps={{ allowClear: true }} />;
}
export function WarehouseFilter({ hidden }: { hidden?: boolean }) {
  return <ProFormText name="warehouse" label="仓库" hidden={hidden} placeholder="名称或编码" />;
}
