import { DatePicker, Segmented, Select, Space, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useSearchParams } from '@umijs/max';
import type { AnalysisQuery } from '@wms/contracts';
import { analysisQuerySchema } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { dashboardCopy as copy } from './dashboard-copy';
import {
  ANALYSIS_PRESETS,
  defaultAnalysisRange,
  isAnalysisPreset,
  rangeForPreset,
  rangePreset,
  shanghaiToday,
  type AnalysisPreset,
} from './date-range';

const { RangePicker } = DatePicker;

function readDates(search: URLSearchParams): [string, string] {
  const defaults = defaultAnalysisRange();
  return [search.get('fromDay') ?? defaults[0], search.get('toDay') ?? defaults[1]];
}

function validParams(fromDay: string, toDay: string, basis: string): AnalysisQuery | undefined {
  const result = analysisQuerySchema.safeParse({ fromDay, toDay, basis });
  return result.success && toDay <= shanghaiToday() ? result.data : undefined;
}

function useRangeControls() {
  const [search, setSearch] = useSearchParams();
  const presetParam = search.get('preset');
  const basis: AnalysisQuery['basis'] = search.get('basis') === 'restated' ? 'restated' : 'posted';
  const [fromDay, toDay] = readDates(search),
    selectedPreset = isAnalysisPreset(presetParam) ? presetParam : rangePreset(fromDay, toDay);
  function updateRange(range: [string, string], preset: AnalysisPreset) {
    const next = new URLSearchParams(search);
    next.set('fromDay', range[0]);
    next.set('toDay', range[1]);
    next.set('preset', preset);
    setSearch(next);
  }
  function selectPreset(value: string) {
    if (!isAnalysisPreset(value)) return;
    const range = rangeForPreset(value);
    updateRange(range ?? [fromDay, toDay], value);
  }
  return { fromDay, toDay, basis, selectedPreset, search, setSearch, updateRange, selectPreset };
}

function pickerDates(fromDay: string, toDay: string): [Dayjs, Dayjs] {
  const defaults = defaultAnalysisRange(),
    start = dayjs(fromDay),
    end = dayjs(toDay);
  return [start.isValid() ? start : dayjs(defaults[0]), end.isValid() ? end : dayjs(defaults[1])];
}

export function useDashboardFilterState() {
  const state = useRangeControls(),
    query = validParams(state.fromDay, state.toDay, state.basis);
  return { ...state, query, invalidRange: !query };
}

type FilterState = ReturnType<typeof useDashboardFilterState>;

function PresetField({ state }: { state: FilterState }) {
  return (
    <div style={{ display: 'grid', gap: spacing[4], flex: `1 1 ${spacing[24] * 9}px`, minWidth: 0 }}>
      <Typography.Text type="secondary">{copy.range}</Typography.Text>
      <Select
        aria-label={copy.range}
        value={state.selectedPreset}
        options={ANALYSIS_PRESETS.map((preset) => ({ value: preset, label: copy.preset[preset] }))}
        onChange={state.selectPreset}
      />
    </div>
  );
}

function DateRangeField({ state }: { state: FilterState }) {
  const nextDates = pickerDates(state.fromDay, state.toDay);
  return (
    <div style={{ display: 'grid', gap: spacing[4], flex: `1 1 ${spacing[24] * 12}px`, minWidth: 0 }}>
      <Typography.Text type="secondary">{copy.period}</Typography.Text>
      <RangePicker
        aria-label={copy.period}
        allowClear={false}
        format="YYYY-MM-DD"
        value={nextDates}
        disabledDate={(date) => date.isAfter(dayjs(shanghaiToday()), 'day')}
        onChange={(dates) => {
          if (dates?.[0] && dates[1])
            state.updateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')], 'custom');
        }}
        style={{ width: '100%' }}
      />
    </div>
  );
}

function BasisField({ state }: { state: FilterState }) {
  function changeBasis(value: string) {
    const next = new URLSearchParams(state.search);
    next.set('basis', value);
    state.setSearch(next);
  }
  return (
    <div style={{ display: 'grid', gap: spacing[4] }}>
      <Typography.Text type="secondary">{copy.basis}</Typography.Text>
      <Segmented<string>
        aria-label={copy.basis}
        value={state.basis}
        options={[
          { value: 'posted', label: copy.basisPosted },
          { value: 'restated', label: copy.basisRestated },
        ]}
        onChange={changeBasis}
      />
    </div>
  );
}

function FilterControls({ state }: { state: FilterState }) {
  return (
    <Space wrap size={spacing[16]} align="end" style={{ width: '100%' }}>
      <PresetField state={state} />
      <DateRangeField state={state} />
      <BasisField state={state} />
    </Space>
  );
}

export function DashboardFilters({ state }: { state: FilterState }) {
  return (
    <section aria-label={copy.filters} data-testid="analysis-filters">
      <FilterControls state={state} />
      {state.invalidRange && (
        <Typography.Text type="danger" role="alert" style={{ display: 'block', marginTop: spacing[8] }}>
          {copy.dateInvalid}
        </Typography.Text>
      )}
    </section>
  );
}
