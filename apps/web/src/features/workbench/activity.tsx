import { Col, Row, Space, Typography } from 'antd';
import { Link } from '@umijs/max';
import { workbenchCopy as copy, type Workbench } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { Section } from './section';
import { Metric, timeText } from './metric';

export function Vehicles({ block }: { block: Workbench['vehicleOrders'] }) {
  return (
    <Section title={copy.vehicles} block={block} href="/outbound" action={copy.viewOutbound}>
      {(data) => (
        <>
          <Typography.Paragraph type="secondary">
            {copy.vehicleNote} <Metric metric={data.total} />
          </Typography.Paragraph>
          {data.items.length ? (
            <Space wrap size={spacing[16]}>
              {data.items.map((item) => (
                <span key={`${item.vehicle}-${item.href}`}>
                  {item.vehicle} · <Link to={item.href}>{item.number}</Link> · {item.label}
                </span>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">{copy.noVehicles}</Typography.Text>
          )}
        </>
      )}
    </Section>
  );
}
export function Activity({ data }: { data: Workbench }) {
  return (
    <Row gutter={[spacing[16], spacing[16]]}>
      <Col xs={24} lg={16}>
        <Section title={copy.recent} block={data.recent} href="/audit" action={copy.viewAudit}>
          {(rows) => <RecentRows rows={rows} />}
        </Section>
      </Col>
      <Col xs={24} lg={8}>
        <Section title={copy.shortcuts} block={data.shortcuts} href="/inbound/new" action={copy.registerInbound}>
          {(links) => (
            <Space orientation="vertical" size={spacing[16]}>
              {links.map((link) => (
                <Link key={link.href} to={link.href}>
                  {link.label}
                </Link>
              ))}
            </Space>
          )}
        </Section>
      </Col>
    </Row>
  );
}

function RecentRows({ rows }: { rows: NonNullable<Workbench['recent']['data']> }) {
  if (!rows.length) return <Typography.Text type="secondary">{copy.noRecent}</Typography.Text>;
  return (
    <>
      {rows.map((row) => (
        <div key={row.id} style={{ paddingBlock: spacing[4], overflowWrap: 'anywhere' }}>
          <Typography.Text type="secondary">{timeText(row.createdAt)} · </Typography.Text>
          {row.action} · {row.href ? <Link to={row.href}>{row.objectLabel}</Link> : row.objectLabel} · {row.summary} ·{' '}
          {row.result}
        </div>
      ))}
    </>
  );
}
