import { useState } from 'react';
import { Button, Drawer, Select, Tag } from 'antd';
import { agingBandLabels, reportSelections, type ReportFacets } from '@wms/contracts';
import type { ListState } from '../../components/BusinessList/use-list-state';
import { spacing } from '../../theme/design-tokens';
import { reportInteractionCopy as copy } from './interaction-copy';

type Props = { state: ListState; facets?: ReportFacets; aging?: boolean; derived?: boolean };
const dimensions = [
  ['warehouses', 'warehouseCodes', copy.warehouse],
  ['movements', 'movements', copy.movement],
  ['types', 'types', copy.type],
] as const;
function valuesFor(state: ListState, field: string) {
  return reportSelections(
    field === 'movements'
      ? (state.params.movements ?? (state.params.movement === 'all' ? '' : state.params.movement))
      : state.params[field],
  );
}
function optionsFor(facets: ReportFacets | undefined, dimension: keyof ReportFacets, selected: string[]) {
  const options = facets?.[dimension] ?? [];
  return [
    ...options,
    ...selected
      .filter((value) => !options.some((o) => o.value === value))
      .map((value) => ({ value, label: value, count: 0 })),
  ];
}
export function VisualFilters({ state, facets, aging, derived }: Props) {
  const [open, setOpen] = useState(false);
  const groups = dimensions.filter(([dimension]) => !derived || dimension === 'warehouses');
  const change = (field: string, values: string[]) =>
    state.change({ [field]: values.join(','), ...(field === 'movements' ? { movement: 'all' } : {}), page: '1' });
  return (
    <section aria-label={copy.filters} style={{ display: 'grid', gap: spacing[8] }}>
      {groups.map(([dimension, field, label]) => {
        const selected = valuesFor(state, field),
          options = optionsFor(facets, dimension, selected);
        return (
          <div key={dimension} role="group" aria-label={label}>
            <span>{label}：</span>
            {options.map((o) => (
              <Tag.CheckableTag
                key={o.value}
                checked={selected.includes(o.value)}
                onChange={(checked) =>
                  change(field, checked ? [...selected, o.value] : selected.filter((v) => v !== o.value))
                }
              >
                {o.label} ({o.count})
              </Tag.CheckableTag>
            ))}
            {!!selected.length && (
              <Button type="link" size="small" onClick={() => change(field, [])}>
                {copy.clear}
                {label}
              </Button>
            )}
          </div>
        );
      })}
      {aging && <BandSelect state={state} />}
      <div>
        <Button onClick={() => setOpen(true)}>{copy.drawer}</Button>
      </div>
      <Drawer title={copy.drawer} open={open} onClose={() => setOpen(false)}>
        <div style={{ display: 'grid', gap: spacing[16] }}>
          {groups.map(([dimension, field, label]) => {
            const selected = valuesFor(state, field);
            return (
              <label key={dimension}>
                {label}
                <Select
                  mode="multiple"
                  aria-label={label}
                  value={selected}
                  allowClear
                  style={{ width: '100%' }}
                  options={optionsFor(facets, dimension, selected).map((o) => ({
                    value: o.value,
                    label: `${o.label} (${o.count})`,
                  }))}
                  onChange={(values) => change(field, values)}
                />
              </label>
            );
          })}
          {aging && <BandSelect state={state} />}
        </div>
      </Drawer>
    </section>
  );
}
function BandSelect({ state }: { state: ListState }) {
  return (
    <label>
      {copy.band}：
      <Select
        aria-label={copy.band}
        value={state.params.band ?? 'all'}
        options={Object.entries(agingBandLabels).map(([value, label]) => ({ value, label }))}
        onChange={(band) => state.change({ band, page: '1' })}
      />
    </label>
  );
}
