import {
  QueryFilter,
  ProFormDateRangePicker,
  ProFormDatePicker,
  ProFormText,
  ProFormSelect,
} from '@ant-design/pro-components';
import { Segmented } from 'antd';
import type { ListState } from '../../components/BusinessList/use-list-state';
import { businessCopy } from '../../business-copy';

export function reportDefaults() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  return { basis: 'posted', fromDay: today.slice(0, 7) + '-01', toDay: today };
}
export function derivedReportDefaults(): { scope: string; basis: string; fromDay: string; toDay: string };
export function derivedReportDefaults(aging: true): {
  scope: string;
  basis: string;
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
    basis: 'posted',
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
interface FilterOptions {
  state: ListState;
  detail: boolean;
  aging: boolean;
  derived: boolean;
}

function reportFilterDefaults({ derived, aging }: FilterOptions) {
  if (derived) return aging ? derivedReportDefaults(true) : derivedReportDefaults();
  return reportDefaults();
}

function reportFilterInitial({ state, aging }: FilterOptions) {
  return {
    dateRange: [state.params.fromDay, state.params.toDay],
    periodPreset: 'custom',
    ...(aging ? { cutoffDay: state.params.cutoffDay } : {}),
    warehouse: state.params.warehouse,
    product: state.params.product,
    movement: state.params.movement ?? 'all',
  };
}

function ReportBasisToggle({ state }: { state: ListState }) {
  const basis = state.params.basis === 'restated' ? 'restated' : 'posted';
  return (
    <div role="group" aria-label={businessCopy.reportsBasisGroup}>
      <Segmented<string>
        value={basis}
        options={[
          { label: businessCopy.reportsBasisOptionPosted, value: 'posted' },
          { label: businessCopy.reportsBasisOptionRestated, value: 'restated' },
        ]}
        onChange={(value) => state.change({ basis: value === 'restated' ? 'restated' : 'posted' })}
      />
    </div>
  );
}

async function submitReportFilters(values: Record<string, unknown>, options: FilterOptions): Promise<boolean> {
  const { state, detail, aging, derived } = options,
    range = dateRangeFor(derived ? String(values.periodPreset ?? 'custom') : 'custom', values.dateRange);
  if (!range) return false;
  state.searchFor({
    fromDay: range[0],
    toDay: range[1],
    ...(aging ? { cutoffDay: String(values.cutoffDay ?? range[1]) } : {}),
    warehouse: String(values.warehouse ?? ''),
    product: String(values.product ?? ''),
    movement: detail ? String(values.movement ?? 'all') : 'all',
    basis: state.params.basis === 'restated' ? 'restated' : 'posted',
  });
  return true;
}

function ReportFilterFields({ detail, aging, derived }: Omit<FilterOptions, 'state'>) {
  return (
    <>
      {derived && (
        <ProFormSelect
          name="periodPreset"
          label={businessCopy.reportsPeriodPreset}
          options={[
            { value: 'current', label: businessCopy.reportsPeriodCurrent },
            { value: 'previous', label: businessCopy.reportsPeriodPrevious },
            { value: '30days', label: businessCopy.reportsPeriodRecent30 },
            { value: 'custom', label: businessCopy.reportsPeriodCustom },
          ]}
          allowClear={false}
        />
      )}
      <ProFormDateRangePicker
        name="dateRange"
        label={businessCopy.reportsPostedDateRange}
        colProps={{ xs: 24, sm: 24, lg: 12 }}
        rules={[{ required: true, message: businessCopy.reportsDateRangeRequired }]}
        fieldProps={{ allowClear: false }}
      />
      {aging && (
        <ProFormDatePicker
          name="cutoffDay"
          label={businessCopy.reportsAgingCutoff}
          rules={[{ required: true, message: businessCopy.reportsAgingCutoffRequired }]}
          fieldProps={{ allowClear: false }}
        />
      )}
      <ProFormText
        name="warehouse"
        label={businessCopy.reportsWarehouseFilter}
        colProps={{ xs: 24, sm: 12, lg: 6 }}
        placeholder={businessCopy.reportsNameOrCode}
      />
      <ProFormText
        name="product"
        label={businessCopy.reportsProductFilter}
        colProps={{ xs: 24, sm: 12, lg: 6 }}
        placeholder={businessCopy.reportsNameOrCode}
      />
      {detail && (
        <ProFormSelect
          name="movement"
          label={businessCopy.reportsMovementFilter}
          options={[
            { value: 'all', label: businessCopy.reportsMovementAll },
            { value: 'inbound', label: businessCopy.reportsMovementInbound },
            { value: 'outbound', label: businessCopy.reportsMovementOutbound },
          ]}
          allowClear={false}
        />
      )}
    </>
  );
}

function ReportFilterForm({ state, detail, aging, derived }: FilterOptions) {
  const initial = reportFilterInitial({ state, detail, aging, derived }),
    defaults = reportFilterDefaults({ state, detail, aging, derived }),
    basis = state.params.basis === 'restated' ? 'restated' : 'posted';
  return (
    <QueryFilter<Record<string, unknown>>
      key={JSON.stringify(initial)}
      initialValues={initial}
      labelWidth="auto"
      span={{ xs: 24, sm: 12, lg: 12 }}
      defaultCollapsed={false}
      dateFormatter="string"
      searchText={businessCopy.reportsFilterSubmit}
      resetText={businessCopy.reportsFilterReset}
      onReset={() => state.searchFor({ ...defaults, basis })}
      submitter={{ submitButtonProps: { type: 'default' } }}
      onFinish={(values) => submitReportFilters(values, { state, detail, aging, derived })}
    >
      <ReportFilterFields detail={detail} aging={aging} derived={derived} />
    </QueryFilter>
  );
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
  const options = { state, detail, aging, derived };
  return (
    <>
      <ReportBasisToggle state={state} />
      <ReportFilterForm {...options} />
    </>
  );
}
