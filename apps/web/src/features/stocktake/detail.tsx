import { businessCopy } from '../../business-copy';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@umijs/max';
import { Alert, Button, Tag } from 'antd';
import { PageContainer, ProDescriptions } from '@ant-design/pro-components';
import { tonnes, listTime } from '@wms/contracts';
import { stocktakeKeys } from './keys';
import { StocktakeQueryState } from './query-state';
import { StocktakeLines } from './lines';
import { stocktakeStatus } from './list';
import { VoidStocktakeDrawer } from './void-drawer';
import { StocktakePostPanel } from './post-panel';

export function StocktakeDetail() {
  const [voiding, setVoiding] = useState(false);
  const { id = '' } = useParams(),
    query = useQuery(stocktakeKeys.detail(id)),
    take = query.data;
  return (
    <PageContainer
      title={take?.number ?? '盘点详情'}
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
            {take.status === 'counting' && <StocktakePostPanel id={id} />}
            {take.status === 'counting' && (
              <Alert
                showIcon
                type="warning"
                title={`${take.warehouseName} 暂停确认中`}
                description="暂停入库确认、出库确认、调整与撤销；PDA 扫码、补传及冻结照常。正常回写完成自动恢复；进行中仅“作废盘点”可提前释放。没有手动或超时解锁，离开本页或退出登录不会解除暂停。"
              />
            )}
            <ProDescriptions
              column={3}
              title={businessCopy.stocktakeDetail2}
              dataSource={take}
              columns={[
                { title: '仓库', dataIndex: 'warehouseName' },
                { title: businessCopy.stocktakeDetail3, render: () => listTime(take.snapshotAt) },
                { title: '实盘进度', render: () => `${take.recordedCount} / ${take.lineCount} 行` },
                { title: businessCopy.stocktakeDetail4, dataIndex: 'snapshotPackages' },
                { title: businessCopy.stocktakeDetail5, render: () => tonnes(take.snapshotWeightGrams) },
                { title: '差异行数', dataIndex: 'changedCount' },
                ...(take.status === 'counting'
                  ? []
                  : [
                      { title: '结束时间', render: () => (take.closedAt ? listTime(take.closedAt) : '-') },
                      { title: '结束原因', dataIndex: 'closeReason' },
                    ]),
              ]}
            />
            <StocktakeLines id={id} editable={take.status === 'counting'} />
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
