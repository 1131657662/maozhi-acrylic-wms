import { AuditOutlined } from '@ant-design/icons';
import { fontSize } from '../../theme/design-tokens';
import { businessCopy } from '../../business-copy';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@umijs/max';
import { Alert, Button, Space, Tag } from 'antd';
import { PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { tonnes, listTime, stocktakeCopy } from '@wms/contracts';
import { stocktakeKeys } from './keys';
import { StocktakeQueryState } from './query-state';
import { StocktakeLines } from './lines';
import { stocktakeStatus } from './list';
import { VoidStocktakeDrawer } from './void-drawer';
import { StocktakePostPanel } from './post-panel';
import { ObjectAuditTimeline } from '../audit/events';
import { StocktakeReveal } from './reveal';
import { StocktakeExports } from './exports';
import { spacing } from '../../theme/design-tokens';

export function StocktakeDetail() {
  const [voiding, setVoiding] = useState(false);
  const { id = '' } = useParams(),
    query = useQuery(stocktakeKeys.detail(id)),
    take = query.data;
  return (
    <PageContainer
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[4] }}>
          <AuditOutlined style={{ fontSize: fontSize.cardTitle }} />
          {take?.number ?? '盘点详情'}
        </span>
      }
      className="business-list"
      extra={
        <Link to="/stocktakes">
          <Button>返回盘点列表</Button>
        </Link>
      }
    >
      <StocktakeQueryState query={query}>
        {take && (
          <>
            <Tag color={take.status === 'counting' ? 'warning' : 'default'}>{stocktakeStatus[take.status]}</Tag>
            <Tag>{businessCopy.stocktakeDetail1}</Tag>
            <Tag>
              {take.mode === 'open'
                ? stocktakeCopy.open
                : take.visibility === 'hidden'
                  ? stocktakeCopy.hidden
                  : stocktakeCopy.revealed}
            </Tag>
            <Space wrap size={spacing[8]} style={{ display: 'flex', marginBlock: spacing[16] }}>
              {take.status === 'counting' &&
                (take.visibility === 'hidden' ? <StocktakeReveal take={take} /> : <StocktakePostPanel id={id} />)}
              <StocktakeExports take={take} />
            </Space>
            {take.visibility === 'hidden' && <Alert type="info" showIcon title={stocktakeCopy.hiddenDescription} />}
            {take.status === 'counting' && (
              <Alert
                showIcon
                type="warning"
                title={`${take.warehouseName} 暂停确认中`}
                description="暂停入库确认、出库确认、调整与撤销；PDA 扫码和上传照常。库存更新完成后自动恢复；盘点进行中只能作废后提前恢复。离开本页或退出登录不会解除暂停。"
              />
            )}
            <ProDescriptions
              column={3}
              title={take.visibility === 'hidden' ? stocktakeCopy.hiddenSummary : businessCopy.stocktakeDetail2}
              dataSource={take}
              columns={[
                { title: '仓库', dataIndex: 'warehouseName' },
                { title: businessCopy.stocktakeDetail3, render: () => listTime(take.snapshotAt) },
                { title: '实盘进度', render: () => `${take.recordedCount} / ${take.lineCount} 行` },
                ...(take.visibility === 'visible'
                  ? [
                      { title: businessCopy.stocktakeDetail4, dataIndex: 'snapshotPackages' },
                      { title: businessCopy.stocktakeDetail5, render: () => tonnes(take.snapshotWeightGrams) },
                      { title: '差异行数', dataIndex: 'changedCount' },
                    ]
                  : []),
                ...(take.status === 'counting'
                  ? []
                  : [
                      { title: '结束时间', render: () => (take.closedAt ? listTime(take.closedAt) : '-') },
                      { title: '结束原因', dataIndex: 'closeReason' },
                    ]),
              ]}
            />
            <StocktakeLines id={id} editable={take.status === 'counting'} hidden={take.visibility === 'hidden'} />
            <ObjectAuditTimeline kind="stocktake" id={id} />
            {take.status === 'counting' && (
              <Button danger onClick={() => setVoiding(true)}>
                作废盘点
              </Button>
            )}
            {voiding && <VoidStocktakeDrawer take={take} onClose={() => setVoiding(false)} />}
          </>
        )}
      </StocktakeQueryState>
    </PageContainer>
  );
}
