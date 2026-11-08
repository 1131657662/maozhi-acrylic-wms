import { Alert, Empty, Space, Tag } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { catalogOverviewSchema } from '@wms/contracts';
import type { z } from 'zod';

export function CatalogOverview({ overview }: { overview: z.infer<typeof catalogOverviewSchema> }) {
  const { current, gate } = overview;
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        title="条码目录只用于扫码查重量，不是库存"
        description="每次上传当前有效条码的全量快照。新文件中消失的条码不再供新版扫码使用；已扫事实、原重量和原版本永远保留。"
      />
      {current ? (
        <ProDescriptions
          title="服务端当前目录"
          column={3}
          dataSource={current}
          columns={[
            { title: '当前版本', render: () => <Tag color="blue">第 {current.versionId} 版</Tag> },
            { title: '有效条码', render: () => `${current.entryCount} 条` },
            { title: '规格', render: () => `${current.specCount} 种` },
          ]}
        />
      ) : (
        <Empty description="目录尚未初始化，请先完成 v1 迁移" />
      )}
      {current?.entryCount === 0 && <Empty description="当前版本无有效条码；已有扫码事实仍可冻结、确认" />}
      {!gate.allowed && (
        <Alert
          type="warning"
          showIcon
          title="暂不能发布新版本"
          description={
            <ul>
              {gate.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          }
        />
      )}
    </Space>
  );
}
