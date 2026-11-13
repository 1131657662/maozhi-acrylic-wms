import { businessCopy } from '../../business-copy';
import { Alert, Space } from 'antd';
import { ProDescriptions } from '@ant-design/pro-components';
import { catalogOverviewSchema } from '@wms/contracts';
import type { z } from 'zod';
import { Card, EmptyState, SectionTitle, StatusTag, Toolbar } from '../../components/ui';

export function CatalogOverview({ overview }: { overview: z.infer<typeof catalogOverviewSchema> }) {
  const { current, gate } = overview;
  return (
    <section data-testid="catalog-section-overview">
      <Card
        title={
          <SectionTitle
            title={businessCopy.catalogSectionOverview}
            extra={
              <Toolbar>
                <StatusTag status={gate.allowed ? '已放行' : '被阻断'} type={gate.allowed ? 'success' : 'warning'} />
              </Toolbar>
            }
          />
        }
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            title="条码目录只用于扫码查重量，不是库存"
            description={businessCopy.catalogOverview1}
          />
          {current ? (
            <ProDescriptions
              title="服务端当前目录"
              column={3}
              dataSource={current}
              columns={[
                {
                  title: '当前版本',
                  render: () => <StatusTag status={`第 ${current.versionId} 版`} type="processing" />,
                },
                { title: '有效条码', render: () => `${current.entryCount} 条` },
                { title: '规格', render: () => `${current.specCount} 种` },
              ]}
            />
          ) : (
            <EmptyState description="目录尚未初始化，请先完成 v1 迁移" />
          )}
          {current?.entryCount === 0 && (
            <EmptyState description="当前目录无有效条码；已有扫码记录仍可结束扫码并确认出库" />
          )}
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
      </Card>
    </section>
  );
}
