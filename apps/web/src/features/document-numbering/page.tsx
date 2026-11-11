import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Empty, Segmented, Skeleton, Result, Space } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import type { DocumentKind } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { numberingKeys } from './queries';
import { RuleForm } from './rule-form';

export function NumberingPage() {
  const [kind, setKind] = useState<DocumentKind>('inbound');
  const query = useQuery(numberingKeys.rules);
  if (query.isLoading) return <Skeleton active />;
  if (query.error instanceof ApiError && query.error.status === 403)
    return <Result status="403" title="无权查看编号规则" />;
  if (query.error && !query.data)
    return (
      <RequestError
        type="error"
        error={query.error}
        action={<Button onClick={() => void query.refetch()}>重试</Button>}
      />
    );
  const rule = query.data?.find((item) => item.kind === kind);
  return (
    <PageContainer title="单据编号配置" subTitle="预览不占号；以创建成功返回的单号为准。">
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {query.error && (
          <RequestError
            type="error"
            error={query.error}
            action={<Button onClick={() => void query.refetch()}>重试</Button>}
          />
        )}
        <Space>
          <Segmented<DocumentKind>
            value={kind}
            onChange={setKind}
            options={[
              { label: '入库 RK', value: 'inbound' },
              { label: '出库 CK', value: 'outbound' },
            ]}
          />
          <Button onClick={() => void query.refetch()}>刷新预览</Button>
        </Space>
        {rule ? <RuleForm key={kind} rule={rule} /> : <Empty description="暂无编号规则，请刷新重试" />}
      </Space>
    </PageContainer>
  );
}
