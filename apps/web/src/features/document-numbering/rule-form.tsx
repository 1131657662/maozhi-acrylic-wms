import { Alert } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import type { NumberingRule } from '@wms/contracts';
import { numberingCopy as t } from './copy';

export function RuleForm({ rule }: { rule: NumberingRule }) {
  return (
    <>
      <ProDescriptions
        column={1}
        title={rule.kind === 'inbound' ? t.inbound : t.outbound}
        dataSource={rule}
        columns={[
          { title: t.prefix, dataIndex: 'prefix' },
          { title: t.dateRule, render: () => t.dateHint },
          { title: t.width, render: () => t.fixed },
          { title: t.preview, render: () => rule.preview ?? t.unavailable },
        ]}
      />
      {rule.previewError && <Alert type="warning" title={rule.previewError} />}
    </>
  );
}
