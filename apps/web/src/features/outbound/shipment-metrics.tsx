import { Card, Col, Row, Typography, theme } from 'antd';
import type { ShipmentList } from '@wms/contracts';
import { shipmentCopy as text } from './shipment-copy';

export function ShipmentMetrics({ data }: { data: ShipmentList }) {
  const { token } = theme.useToken();
  const metrics = [
    [text.planned, data.plannedPackages, data.plannedWeightGrams],
    [text.shipped, data.effectivePackages, data.effectiveWeightGrams],
    [text.pending, data.remainingPackages, data.remainingWeightGrams],
  ] as const;
  return (
    <Row gutter={[token.margin, token.margin]} data-testid="shipment-metrics">
      {metrics.map(([label, packages, grams]) => (
        <Col key={label} xs={24} md={8}>
          <Card size="small">
            <Typography.Text type="secondary">{label}</Typography.Text>
            <Typography.Title level={4}>{text.quantity(packages, grams)}</Typography.Title>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
