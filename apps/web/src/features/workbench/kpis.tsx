import { lazy, Suspense } from 'react';
import { Col, Row, Typography } from 'antd';
import { Link } from '@umijs/max';
import { workbenchCopy as copy, type Workbench } from '@wms/contracts';
import { Card } from '../../components/ui/Card';
import { fontSize, fontWeight, spacing } from '../../theme/design-tokens';
import { Metric, metricText } from './metric';
import { AfterPaint } from './after-paint';

const Sparkline = lazy(() => import('./trend').then((module) => ({ default: module.Sparkline })));
function MovementKpi({ data, kind }: { data: Workbench; kind: 'inbound' | 'outbound' }) {
  const movement = data.today.data;
  return (
    <Card title={<Link to={`/${kind}`}>{copy[kind]}</Link>} testId={`workbench-${kind}`}>
      <div style={{ fontSize: fontSize.kpi, fontWeight: fontWeight.semibold }}>
        <Metric metric={movement?.[kind].grams} />
      </div>
      <div>
        <Metric metric={movement?.[kind].packages} />
      </div>
      <Typography.Text type="secondary">
        {data.today.reason ??
          (movement?.[`${kind}Change`].reason || `${copy.previous} ${metricText(movement?.[`${kind}Change`])}`)}
      </Typography.Text>
      <AfterPaint>
        <Suspense fallback={null}>
          <Sparkline points={data.trend14d.data} kind={kind} />
        </Suspense>
      </AfterPaint>
    </Card>
  );
}
export function Kpis({ data }: { data: Workbench }) {
  const pending = data.pending.data;
  return (
    <Row gutter={[spacing[16], spacing[16]]}>
      <Col xs={24} sm={12} lg={6}>
        <MovementKpi data={data} kind="inbound" />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <MovementKpi data={data} kind="outbound" />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card title={<a href="#workbench-todos">{copy.pending}</a>}>
          <div style={{ fontSize: fontSize.kpi, fontWeight: fontWeight.semibold }}>
            <Metric metric={pending?.total} />
          </div>
          <Typography.Paragraph type="secondary">{copy.pendingHelp}</Typography.Paragraph>
          <Typography.Text type="secondary">{data.pending.reason ?? copy.history}</Typography.Text>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card title={<Link to="/stocktakes?status=counting">{copy.stocktake}</Link>}>
          <div style={{ fontSize: fontSize.kpi, fontWeight: fontWeight.semibold }}>
            <Metric metric={pending?.stocktake.count} />
          </div>
          <Typography.Paragraph type="secondary">{copy.lockHelp}</Typography.Paragraph>
          <Typography.Text type="secondary">{data.pending.reason ?? copy.history}</Typography.Text>
        </Card>
      </Col>
    </Row>
  );
}
