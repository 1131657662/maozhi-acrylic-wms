import { Col, Descriptions, Row, Alert, Typography } from 'antd';
import { workbenchCopy as copy, type Workbench } from '@wms/contracts';
import { spacing } from '../../theme/design-tokens';
import { Metric, timeText } from './metric';
import { Section } from './section';

export function Evidence({ data }: { data: Workbench }) {
  return (
    <Row gutter={[spacing[16], spacing[16]]}>
      <Col xs={24} lg={12}>
        <Section title={copy.catalog} block={data.catalogHealth} href="/catalog" action={copy.viewCatalog}>
          {(catalog) => (
            <>
              {catalog.expired && <Alert type="warning" title={copy.catalogExpired} showIcon />}
              <Descriptions
                size="small"
                column={2}
                items={[
                  { label: copy.version, children: catalog.version },
                  { label: copy.entries, children: <Metric metric={catalog.entries} /> },
                  { label: copy.published, children: timeText(catalog.publishedAt), span: 2 },
                  ...(['added', 'removed', 'weight'] as const).map((key) => ({
                    label: copy[key],
                    children: <Metric metric={catalog[key]} />,
                  })),
                ]}
              />
            </>
          )}
        </Section>
      </Col>
      <Col xs={24} lg={12}>
        <Section title={copy.handoff} block={data.handoffEvidence} href="/catalog" action={copy.viewHandoff}>
          {(handoff) => (
            <>
              <Descriptions
                size="small"
                column={2}
                items={[
                  { label: copy.unresolved, children: <Metric metric={handoff.unresolved} /> },
                  { label: copy.handoffOrders, children: <Metric metric={handoff.orders} /> },
                  { label: copy.conflicts, children: <Metric metric={handoff.conflicts} /> },
                  { label: copy.registeredAt, children: timeText(handoff.registeredAt) },
                  { label: copy.conflictAt, children: timeText(handoff.conflictAt), span: 2 },
                ]}
              />
              <Typography.Text type="secondary">{copy.evidenceNote}</Typography.Text>
            </>
          )}
        </Section>
      </Col>
    </Row>
  );
}
