import {
  QueryFilter,
  ProFormDateRangePicker,
  ProFormDatePicker,
  ProFormText,
  ProFormSelect,
  type ProFormInstance,
} from '@ant-design/pro-components';
import { useRef } from 'react';
import { Segmented } from 'antd';
import type { ListState } from '../../components/BusinessList/use-list-state';
import { businessCopy } from '../../business-copy';

import { reportDefaults, derivedReportDefaults, dateRangeFor } from './date-presets';
export { reportDefaults, derivedReportDefaults } from './date-presets';
import { chartCopy } from './chart-copy';
import type { ReportFacets } from '@wms/contracts';
import { VisualFilters } from './visual-filters';

interface FilterOptions {
  state: ListState;
  detail: boolean;
  aging: boolean;
  derived: boolean;
}

function reportFilterDefaults({ derived, aging, detail }: FilterOptions) {
  if (derived) return aging ? derivedReportDefaults(true) : derivedReportDefaults();
  return reportDefaults(detail ? undefined : 'monthly');
}

function reportFilterInitial(options: FilterOptions) {
  const { state, aging, detail, derived } = options;
  const defaults = reportFilterDefaults(options);
  const isDefault = state.params.fromDay === defaults.fromDay && state.params.toDay === defaults.toDay;
  return {
    dateRange: [state.params.fromDay, state.params.toDay],
    periodPreset: !detail && !aging && isDefault ? (derived ? 'recent6' : 'recent12') : 'custom',
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
    range = dateRangeFor(!detail ? String(values.periodPreset ?? 'custom') : 'custom', values.dateRange);
  if (!range) return false;
  state.searchFor({
    ...Object.fromEntries(
      ['warehouseCodes', 'productCode', 'movements', 'types', 'band']
        .filter((key) => state.params[key] !== undefined)
        .filter((key) => key !== 'movements' || !detail || values.movement === state.params.movement)
        .map((key) => [key, state.params[key]!]),
    ),
    fromDay: range[0],
    toDay: range[1],
    ...(aging ? { cutoffDay: String(values.cutoffDay ?? range[1]) } : {}),
    warehouse: String(values.warehouse ?? ''),
    product: String(values.product ?? ''),
    ...(!derived
      ? {
          movement: detail ? String(values.movement ?? 'all') : 'all',
        }
      : {}),
    basis: state.params.basis === 'restated' ? 'restated' : 'posted',
  });
  return true;
}

function ReportFilterFields({ detail, aging, derived }: Omit<FilterOptions, 'state'>) {
  return (
    <>
      {!detail && (
        <ProFormSelect
          name="periodPreset"
          label={businessCopy.reportsPeriodPreset}
          options={[
            ...(!aging
              ? [{ value: derived ? 'recent6' : 'recent12', label: derived ? chartCopy.recent6 : chartCopy.recent12 }]
              : []),
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
        label={chartCopy.dateRange}
        colProps={{ xs: 24, sm: 24, lg: 12 }}
        rules={[{ required: true, message: chartCopy.dateRequired }]}
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
  const form = useRef<ProFormInstance | undefined>(undefined);
  const initial = reportFilterInitial({ state, detail, aging, derived }),
    defaults = reportFilterDefaults({ state, detail, aging, derived }),
    basis = state.params.basis === 'restated' ? 'restated' : 'posted';
  return (
    <QueryFilter<Record<string, unknown>>
      formRef={form}
      onValuesChange={(changed) => {
        if ('dateRange' in changed) form.current?.setFieldsValue({ periodPreset: 'custom' });
      }}
      key={JSON.stringify(initial)}
      initialValues={initial}
      labelWidth="auto"
      span={{ xs: 24, sm: 12, lg: 12 }}
      defaultCollapsed={false}
      dateFormatter="string"
      searchText={businessCopy.reportsFilterSubmit}
      resetText={chartCopy.reset}
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
  facets,
}: {
  state: ListState;
  detail?: boolean;
  aging?: boolean;
  derived?: boolean;
  facets?: ReportFacets;
}) {
  const options = { state, detail, aging, derived };
  return (
    <>
      <ReportBasisToggle state={state} />
      <ReportFilterForm {...options} />
      <VisualFilters state={state} facets={facets} aging={aging} derived={derived} />
    </>
  );
}
