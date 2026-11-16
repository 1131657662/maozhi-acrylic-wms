import { Col, Row, Tag, Typography } from 'antd';
import { Link } from '@umijs/max';
import { workbenchCopy as copy, type Workbench, type WorkbenchTodo } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { Section } from './section';
import { Metric } from './metric';

function Todo({ item }: { item: WorkbenchTodo }) {
  return (
    <div style={{ paddingBlock: spacing[8], overflowWrap: 'anywhere' }}>
      <Link to={item.href}>{item.number}</Link>
      <div>
        <Typography.Text type="secondary">
          {item.warehouse} · {item.label}
        </Typography.Text>
      </div>
      {item.elapsedHours !== null && (
        <div>
          {copy.elapsed} {item.elapsedHours.toFixed(1)} {copy.hours}{' '}
          {item.overdue && <Tag color="warning">{copy.overdue}</Tag>}
        </div>
      )}
    </div>
  );
}
export function Todos({ block }: { block: Workbench['pending'] }) {
  const groups = [
    { key: 'inbound', label: copy.inboundPending, href: '/inbound?postingState=pending' },
    { key: 'outbound', label: copy.outboundPending, href: '/outbound' },
    { key: 'stocktake', label: copy.stocktake, href: '/stocktakes?status=counting' },
    { key: 'stale', label: copy.stale, href: '/outbound' },
  ] as const;
  return (
    <div id="workbench-todos" data-testid="workbench-todos">
      <Section title={copy.todos} block={block} href="/outbound" action={copy.viewOutbound}>
        {(data) => (
          <Row gutter={[spacing[16], spacing[16]]}>
            {groups.map((group) => (
              <Col xs={24} sm={12} lg={6} key={group.key}>
                <strong>
                  <Link to={group.href}>{group.label}</Link> · <Metric metric={data[group.key].count} />
                </strong>
                {data[group.key].items.length ? (
                  data[group.key].items.map((item) => <Todo key={item.href} item={item} />)
                ) : (
                  <Typography.Paragraph type="secondary">{copy.noTodos}</Typography.Paragraph>
                )}
                {group.key === 'stale' && (data.missingScanTime.value ?? 0) > 0 && (
                  <Typography.Text type="warning">
                    {copy.missingScan} · <Metric metric={data.missingScanTime} />
                  </Typography.Text>
                )}
              </Col>
            ))}
          </Row>
        )}
      </Section>
    </div>
  );
}
