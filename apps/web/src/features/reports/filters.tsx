import { QueryFilter, ProFormDateRangePicker, ProFormText, ProFormSelect } from '@ant-design/pro-components';
import type { ListState } from '../../components/BusinessList/use-list-state';

export function reportDefaults() {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
  return { fromDay: today.slice(0, 7) + '-01', toDay: today };
}
export function ReportFilters({ state, detail = false }: { state: ListState; detail?: boolean }) {
  const initial = {
    dateRange: [state.params.fromDay, state.params.toDay],
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
        const range = values.dateRange;
        if (!Array.isArray(range) || range.length !== 2) return false;
        state.searchFor({
          fromDay: String(range[0]),
          toDay: String(range[1]),
          warehouse: String(values.warehouse ?? ''),
          product: String(values.product ?? ''),
          movement: detail ? String(values.movement ?? 'all') : 'all',
        });
        return true;
      }}
    >
      <ProFormDateRangePicker
        name="dateRange"
        label="入账日期"
        colProps={{ xs: 24, sm: 24, lg: 12 }}
        rules={[{ required: true, message: '请选择完整入账日期范围' }]}
        fieldProps={{ allowClear: false }}
      />
      <ProFormText name="warehouse" label="仓库" colProps={{ xs: 24, sm: 12, lg: 6 }} placeholder="名称或编码" />
      <ProFormText name="product" label="ERP 商品" colProps={{ xs: 24, sm: 12, lg: 6 }} placeholder="名称或编码" />
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
