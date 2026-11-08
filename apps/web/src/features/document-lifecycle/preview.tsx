import { Alert, Space, Typography } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { tonnes, type LifecyclePreview } from '@wms/contracts';

export function CompensationPreview({ preview }: { preview: LifecyclePreview }) {
  return (
    <Space orientation="vertical" style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        title={preview.action === 'reverse' ? '仅纠正误确认，不处理实物退货' : '仅作废未入账单据'}
        description="完成后原单、原流水和原单号保留；不能重开确认或扫码。更正与退货不在本批范围。"
      />
      {preview.originalOperationId && (
        <Typography.Paragraph copyable>原确认操作：{preview.originalOperationId}</Typography.Paragraph>
      )}
      {preview.lines.map((line) => (
        <ProDescriptions
          key={line.journalId}
          title={line.productCode}
          column={1}
          dataSource={line}
          columns={[
            { title: '仓库', dataIndex: 'warehouseCode' },
            { title: '原流水', render: () => `#${line.journalId}` },
            { title: '当前库存', render: () => `${line.packagesBefore} 包 / ${tonnes(line.weightBeforeGrams)} 吨` },
            { title: '反向补偿', render: () => `${line.packagesDelta} 包 / ${tonnes(line.weightDeltaGrams)} 吨` },
            { title: '补偿后库存', render: () => `${line.packagesAfter} 包 / ${tonnes(line.weightAfterGrams)} 吨` },
          ]}
        />
      ))}
      {preview.blockers.length > 0 && (
        <Alert
          type="warning"
          showIcon
          title="当前不能执行"
          description={
            <ul>
              {preview.blockers.map((b, i) => (
                <li key={`${b.code}:${i}`}>{b.message}</li>
              ))}
            </ul>
          }
        />
      )}
    </Space>
  );
}
