import { Children, isValidElement, useRef, useState, type ReactNode } from 'react';
import { Button, Drawer, Space, Tag } from 'antd';
import { FilterOutlined } from '@ant-design/icons';
import { ProForm, ProFormGroup } from '@ant-design/pro-components';
import type { ListState } from './use-list-state';
import { FILTER_DRAWER_WIDTH, filterText, filterValue } from './filter-text';

interface Props {
  state: ListState;
  kind: 'inbound' | 'outbound';
  children: ReactNode;
  initialValues: Record<string, unknown>;
  toParams: (values: Record<string, unknown>) => Record<string, string>;
}

function FilterGroups({ children }: { children: ReactNode }) {
  const groups: Record<keyof typeof filterText.groups, ReactNode[]> = {
    document: [],
    product: [],
    party: [],
    other: [],
  };
  Children.forEach(children, (child) => {
    if (!isValidElement<{ name?: string }>(child)) return;
    const name = child.props.name ?? String(child.key ?? '');
    const group = /billType|keyword|dateRange|statusChoice|postingState/.test(name)
      ? 'document'
      : /product/.test(name)
        ? 'product'
        : /supplier|customer/.test(name)
          ? 'party'
          : 'other';
    groups[group].push(child);
  });
  return Object.entries(groups).map(
    ([group, fields]) =>
      fields.length > 0 && (
        <ProFormGroup key={group} title={filterText.groups[group as keyof typeof groups]}>
          {fields}
        </ProFormGroup>
      ),
  );
}

function FilterTags({ state, kind }: Pick<Props, 'state' | 'kind'>) {
  return Object.entries(state.params)
    .filter(([key, value]) => filterText.fields[key] && value)
    .map(([key, value]) => (
      <Tag
        key={key}
        closable
        onClose={() => {
          const next = { ...state.params };
          delete next[key];
          if (key === 'from' || key === 'to') {
            delete next.from;
            delete next.to;
          }
          if (key === 'productCodes') delete next.productMode;
          state.searchFor(next);
        }}
      >
        {filterText.fields[key]}：{filterValue(key, value, kind)}
      </Tag>
    ));
}

export function AdvancedFilters({ state, kind, children, initialValues, toParams }: Props) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => {
    setOpen(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  };
  const count = Object.entries(state.params).filter(([key, value]) => filterText.fields[key] && value).length;
  return (
    <>
      <Space wrap>
        <Button ref={trigger} icon={<FilterOutlined aria-hidden />} onClick={() => setOpen(true)}>
          {filterText.trigger}（{count}）
        </Button>
        <FilterTags state={state} kind={kind} />
      </Space>
      <Drawer
        title={filterText.title}
        open={open}
        size={FILTER_DRAWER_WIDTH}
        destroyOnHidden
        focusable={{ focusTriggerAfterClose: false }}
        onClose={close}
        styles={{ wrapper: { maxWidth: '100vw' } }}
      >
        <ProForm<Record<string, unknown>>
          key={JSON.stringify(initialValues)}
          initialValues={initialValues}
          dateFormatter="string"
          onFinish={async (values) => {
            state.searchFor(toParams(values));
            close();
            return true;
          }}
          submitter={{
            searchConfig: { submitText: filterText.query, resetText: filterText.reset },
            submitButtonProps: { type: 'default' },
            onReset: () => state.reset(),
          }}
        >
          <FilterGroups>{children}</FilterGroups>
        </ProForm>
      </Drawer>
    </>
  );
}
