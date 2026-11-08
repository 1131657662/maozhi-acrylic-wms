import { Alert } from 'antd';
import { ProForm, ProFormDigit, ProDescriptions } from '@ant-design/pro-components';
import type { NumberingRule } from '@wms/contracts';
import { useSaveNumbering } from './queries';

export function RuleForm({ rule }: { rule: NumberingRule }) {
  const save = useSaveNumbering(rule.kind);
  return (
    <>
      <ProDescriptions
        column={1}
        title={rule.kind === 'inbound' ? '入库编号规则' : '出库编号规则'}
        dataSource={rule}
        columns={[
          { title: '固定前缀', dataIndex: 'prefix' },
          { title: '日期规则', render: () => 'YYYYMMDD · 北京时间 · 按日独立计数' },
          { title: '下一个号（未占用）', render: () => rule.preview ?? '暂不可取号' },
        ]}
      />
      {rule.previewError && <Alert type="warning" title={rule.previewError} />}
      {save.error && <Alert type="error" title={save.error.message} />}
      {save.isSuccess && <Alert type="success" title="编号配置已保存" />}
      <ProForm<{ width: number }>
        initialValues={{ width: rule.width }}
        onFinish={async ({ width }) => {
          try {
            await save.mutateAsync({ width, expectedVersion: rule.version });
            return true;
          } catch {
            return false;
          }
        }}
        submitter={{ searchConfig: { submitText: '保存编号规则' }, resetButtonProps: false }}
      >
        <ProFormDigit
          name="width"
          label="序号宽度"
          rules={[{ required: true }]}
          fieldProps={{ min: 2, max: 8, precision: 0 }}
          extra="允许 2–8 位；修改只改变补零，不重置序号。撞号或容量不足时保留原配置。"
        />
      </ProForm>
    </>
  );
}
