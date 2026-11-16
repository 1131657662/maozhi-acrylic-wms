import { lazy, Suspense } from 'react';
import { Alert, Button, Col, Row, Skeleton, Space, Typography } from 'antd';
import { AppstoreOutlined, ReloadOutlined } from '@ant-design/icons';
import { workbenchCopy as copy, type Workbench } from '@wms/contracts';
import { PageShell } from '../../components/ui/PageShell';
import { Card } from '../../components/ui/Card';
import { spacing } from '../../theme/design-tokens';
import { useWorkbench } from './use-workbench';
import { Kpis } from './kpis';
import { Todos } from './todos';
import { Evidence } from './evidence';
import { Activity, Vehicles } from './activity';
import { AfterPaint } from './after-paint';
import { timeText } from './metric';

const Trend = lazy(() => import('./trend'));
function Content({ data }: { data: Workbench }) {
  return (
    <Space orientation="vertical" size={spacing[16]} style={{ display: 'flex' }} data-testid="workbench-content">
      {data.verification === 'failed' && <Alert title={copy.partial} type="warning" showIcon />}
      <Kpis data={data} />
      <Todos block={data.pending} />
      <Evidence data={data} />
      <Vehicles block={data.vehicleOrders} />
      <Activity data={data} />
      <AfterPaint>
        <Suspense fallback={null}>
          <Trend block={data.trend14d} />
        </Suspense>
      </AfterPaint>
    </Space>
  );
}
export function WorkbenchView() {
  const query = useWorkbench();
  return (
    <PageShell
      title={copy.title}
      icon={<AppstoreOutlined />}
      description={copy.description}
      actions={
        <Button icon={<ReloadOutlined />} loading={query.isFetching} onClick={() => void query.refetch()}>
          {copy.refresh}
        </Button>
      }
    >
      {query.error && <Alert title={copy.failed} type="error" showIcon />}
      {query.data && (
        <>
          <Typography.Paragraph type="secondary">
            {copy.asOf} {timeText(query.data.asOf)} · {copy.basis}
          </Typography.Paragraph>
          <Content data={query.data} />
        </>
      )}
      {query.isPending && !query.error && <LoadingKpis />}
    </PageShell>
  );
}

function LoadingKpis() {
  return (
    <Row gutter={[spacing[16], spacing[16]]}>
      {Array.from({ length: 4 }, (_, i) => (
        <Col xs={24} sm={12} lg={6} key={i}>
          <Card>
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
