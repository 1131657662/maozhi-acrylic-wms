import {
  QueryFilter,
  ProFormDateRangePicker,
  ProFormDatePicker,
  ProFormText,
  ProFormSelect,
} from '@ant-design/pro-components';
import type { ListState } from '../../components/BusinessList/use-list-state';

export function reportDefaults() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  return { fromDay: today.slice(0, 7) + '-01', toDay: today };
}
export function derivedReportDefaults(): { scope: string; fromDay: string; toDay: string };
export function derivedReportDefaults(aging: true): {
  scope: string;
  fromDay: string;
  toDay: string;
  cutoffDay: string;
};
export function derivedReportDefaults(aging = false) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10),
    monthStart = today.slice(0, 7) + '-01';
  return {
    scope: 'inventory',
    fromDay: monthStart,
    toDay: yesterday < monthStart ? today : yesterday,
    ...(aging ? { cutoffDay: today } : {}),
  };
}
function dateRangeFor(preset: string, custom: unknown): [string, string] | null {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    yesterday = new Date(Date.parse(today + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10),
    monthStart = today.slice(0, 7) + '-01';
  if (preset === 'current') return [monthStart, yesterday < monthStart ? today : yesterday];
  if (preset === 'previous') {
    const lastDay = new Date(Date.parse(monthStart + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    return [lastDay.slice(0, 7) + '-01', lastDay];
  }
  if (preset === '30days')
    return [new Date(Date.parse(yesterday + 'T00:00:00Z') - 29 * 86400000).toISOString().slice(0, 10), yesterday];
  return Array.isArray(custom) && custom.length === 2 ? [String(custom[0]), String(custom[1])] : null;
}
export function ReportFilters({
  state,
  detail = false,
  aging = false,
  derived = false,
}: {
  state: ListState;
  detail?: boolean;
  aging?: boolean;
  derived?: boolean;
}) {
  const initial = {
    dateRange: [state.params.fromDay, state.params.toDay],
    periodPreset: 'custom',
    cutoffDay: state.params.cutoffDay,
    warehouse: state.params.warehouse,
    product: state.params.product,
    movement: state.params.movement ?? 'all',
  };
  return (
    <QueryFilter<Record<string, unknown>>
      key={JSON.stringify(initial)}
      initialValues={initial}
      labelWidth="auto"
      span={{ xs: 24, sm: 12, lg: 12 }}
      defaultCollapsed={false}
      dateFormatter="string"
      searchText="查询"
      resetText="本月"
      onReset={state.reset}
      submitter={{ submitButtonProps: { type: 'default' } }}
      onFinish={async (values) => {
        const range = dateRangeFor(derived ? String(values.periodPreset ?? 'custom') : 'custom', values.dateRange);
        if (!range) return false;
        state.searchFor({
          fromDay: range[0],
          toDay: range[1],
          ...(aging ? { cutoffDay: String(values.cutoffDay ?? range[1]) } : {}),
          warehouse: String(values.warehouse ?? ''),
          product: String(values.product ?? ''),
          movement: detail ? String(values.movement ?? 'all') : 'all',
        });
        return true;
      }}
    >
      {derived && (
        <ProFormSelect
          name="periodPreset"
          label="期间预设"
          options={[
            { value: 'current', label: '本月 1 日至昨日' },
            { value: 'previous', label: '上月' },
            { value: '30days', label: '近 30 天' },
            { value: 'custom', label: '自定义' },
          ]}
          allowClear={false}
        />
      )}
      <ProFormDateRangePicker
        name="dateRange"
        label="入账日期"
        colProps={{ xs: 24, sm: 24, lg: 12 }}
        rules={[{ required: true, message: '请选择完整入账日期范围' }]}
        fieldProps={{ allowClear: false }}
      />
      {aging && (
        <ProFormDatePicker
          name="cutoffDay"
          label="库龄截止日"
          rules={[{ required: true, message: '请选择库龄截止日' }]}
          fieldProps={{ allowClear: false }}
        />
      )}
      <ProFormText name="warehouse" label="仓库" colProps={{ xs: 24, sm: 12, lg: 6 }} placeholder="名称或编码" />
      <ProFormText name="product" label="商品" colProps={{ xs: 24, sm: 12, lg: 6 }} placeholder="名称或编码" />
      {detail && (
        <ProFormSelect
          name="movement"
          label="明细方向"
          options={[
            { value: 'all', label: '全部（含撤销）' },
            { value: 'inbound', label: '入库（含撤销）' },
            { value: 'outbound', label: '出库（含撤销）' },
          ]}
          allowClear={false}
        />
      )}
    </QueryFilter>
  );
}
