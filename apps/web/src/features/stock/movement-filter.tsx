import { useState } from 'react';
import { Button, Form, Input, Space } from 'antd';
import { movementCopy as copy } from './movement-copy';

export function MovementFilter(props: {
  initialWarehouse: string;
  initialProduct: string;
  submit: (warehouse: string, product: string) => void;
  reset: () => void;
}) {
  const [warehouse, setWarehouse] = useState(props.initialWarehouse);
  const [product, setProduct] = useState(props.initialProduct);
  return (
    <Space wrap>
      <Form.Item label={copy.warehouseCode} style={{ marginBottom: 0 }}>
        <Input
          aria-label={copy.warehouseCode}
          value={warehouse}
          maxLength={80}
          onChange={(event) => setWarehouse(event.target.value)}
        />
      </Form.Item>
      <Form.Item label={copy.productCode} style={{ marginBottom: 0 }}>
        <Input
          aria-label={copy.productCode}
          value={product}
          maxLength={80}
          onChange={(event) => setProduct(event.target.value)}
        />
      </Form.Item>
      <Button type="primary" onClick={() => props.submit(warehouse, product)}>
        {copy.query}
      </Button>
      <Button onClick={props.reset}>{copy.reset}</Button>
    </Space>
  );
}
