import { useState } from 'react';
import { Button, Drawer, Space, Tag } from 'antd';
import { QueryFilter, ProForm, ProFormDateRangePicker, ProFormSelect, ProFormText } from '@ant-design/pro-components';
import { auditActions, auditAction } from '@wms/contracts';
import type { ListState } from '../../components/BusinessList/use-list-state';
import { auditCopy as t } from './text';
import { auditDateDefaults, auditDatePresets } from './dates';

const advancedKeys = ['channel', 'result', 'dangerous'] as const;
function initial(params: Record<string, string>) {
  const dates = { ...auditDateDefaults(), ...params };
  return { ...params, dateRange: [dates.from.slice(0, 10), dates.to.slice(0, 10)] };
}
function quickParams(values: Record<string, unknown>) {
  const result: Record<string, string> = {};
  for (const key of ['action', 'keyword'])
    if (typeof values[key] === 'string' && values[key]) result[key] = values[key];
  const dates = values.dateRange;
  if (Array.isArray(dates) && dates.length === 2) {
    result.from = `${dates[0]}T00:00:00+08:00`;
    result.to = `${dates[1]}T23:59:59.999+08:00`;
  }
  return { ...auditDateDefaults(), ...result };
}
export function AuditFilters({ state }: { state: ListState }) {
  const [open, setOpen] = useState(false);
  const active = advancedKeys.filter((key) => state.params[key]);
  const actions = [...new Set(Object.values(auditActions).map((action) => action.label))].map((label) => ({
    value: label,
    label,
  }));
  if (state.params.action && !actions.some((item) => item.value === state.params.action))
    actions.push({ value: state.params.action, label: auditAction(state.params.action).label });
  return (
    <div id="audit-filters">
      <QueryFilter<Record<string, unknown>>
        key={JSON.stringify(state.params)}
        initialValues={initial(state.params)}
        labelWidth="auto"
        span={12}
        defaultCollapsed={false}
        dateFormatter="string"
        searchText={t.query}
        resetText={t.reset}
        submitter={{ submitButtonProps: { type: 'default' } }}
        onReset={state.reset}
        onFinish={async (values) => {
          state.searchFor({
            ...Object.fromEntries(active.map((key) => [key, state.params[key]!])),
            ...quickParams(values),
          });
          return true;
        }}
      >
        <ProFormDateRangePicker
          name="dateRange"
          label={t.filterTime}
          fieldProps={{ allowClear: false, presets: auditDatePresets() }}
        />
        <ProFormSelect name="action" label={t.filterAction} placeholder={t.allActions} showSearch options={actions} />
        <ProFormText name="keyword" label={t.filterKeyword} placeholder={t.keywordPlaceholder} />
      </QueryFilter>
      <Space wrap>
        <Button onClick={() => setOpen(true)}>
          {t.filters}
          {active.length ? ` · ${active.length}` : ''}
        </Button>
        {active.map((key) => (
          <Tag key={key} closeIcon onClose={() => state.change({ [key]: '', page: '1' })}>
            {
              [...t.channels, ...t.results, ...t.dangerOptions].find((option) => option.value === state.params[key])
                ?.label
            }
          </Tag>
        ))}
      </Space>
      <Drawer title={t.filters} size={480} open={open} onClose={() => setOpen(false)} destroyOnHidden>
        <ProForm<Record<string, string>>
          key={JSON.stringify(state.params)}
          initialValues={state.params}
          submitter={{ searchConfig: { submitText: t.apply, resetText: t.reset } }}
          onFinish={async (values) => {
            state.change({ ...Object.fromEntries(advancedKeys.map((key) => [key, values[key] ?? ''])), page: '1' });
            setOpen(false);
            return true;
          }}
        >
          <ProFormSelect name="channel" label={t.channel} options={t.channels} />
          <ProFormSelect name="result" label={t.result} options={t.results} />
          <ProFormSelect name="dangerous" label={t.dangerous} options={t.dangerOptions} />
        </ProForm>
      </Drawer>
    </div>
  );
}
