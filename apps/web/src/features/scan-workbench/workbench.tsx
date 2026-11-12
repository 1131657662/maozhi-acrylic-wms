import { useState } from 'react';
import { Alert, Button, Collapse, Drawer, Flex, Select, Typography } from 'antd';
import { BarcodeOutlined } from '@ant-design/icons';
import type { Detail } from '@wms/contracts';
import { useCountingCommand } from './use-counting-command';
import { CountingProgress } from './progress';
import { CountingRecords } from './record-table';
import { CountingEntry } from './entry';
import { CountingPaste } from './paste';
import { CountingError } from './command-error';
import { CountingFooter } from './footer';
import { text, COUNTING_DRAWER_WIDTH } from './copy';

export function Workbench({ order, prefill }: { order: Detail; prefill: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{text.title}</Button>
      {open && <WorkbenchBody order={order} prefill={prefill} close={() => setOpen(false)} />}
    </>
  );
}
function WorkbenchBody({
  order,
  prefill,
  close,
}: {
  order: Detail;
  prefill: () => Promise<boolean>;
  close: () => void;
}) {
  const products = [...new Map(order.lines.map((l) => [l.productCode, l])).values()];
  const initial =
    order.lines.find((l) => l.plannedPackages > l.actualPackages || l.plannedWeightGrams > l.actualWeightGrams) ??
    order.lines[0];
  const [selected, setSelected] = useState(initial?.productCode ?? '');
  const [expanded, setExpanded] = useState(false);
  const productCode = products.some((l) => l.productCode === selected) ? selected : (products[0]?.productCode ?? '');
  const command = useCountingCommand(order.id);
  const editable = order.status === 'open';
  return (
    <Drawer
      title={
        <>
          <BarcodeOutlined /> {text.title} · {order.orderNo}
        </>
      }
      open
      size={expanded ? '100%' : COUNTING_DRAWER_WIDTH}
      onClose={close}
      extra={<Button onClick={() => setExpanded(!expanded)}>{expanded ? text.collapse : text.expand}</Button>}
      footer={<CountingFooter order={order} command={command} prefill={prefill} close={close} />}
    >
      <Flex vertical gap="middle">
        <Alert type="info" title={text.notice} />
        {!editable && <Alert type="info" title={text.readonly} />}
        {editable && order.scanClosedAt && <Alert type="warning" title={text.closed} />}
        <CountingProgress id={order.id} />
        <label>{text.current}</label>
        <Select
          aria-label={text.current}
          value={productCode}
          onChange={setSelected}
          disabled={command.busy}
          options={products.map((p) => ({
            value: p.productCode,
            label: (
              <>
                <span>{p.productName}</span> <Typography.Text type="secondary">{p.productCode}</Typography.Text>
              </>
            ),
          }))}
        />
        {editable && !order.scanClosedAt && (
          <>
            <CountingEntry key={productCode} id={order.id} productCode={productCode} command={command} />
            <Collapse
              items={[
                {
                  key: 'paste',
                  label: text.paste,
                  children: (
                    <CountingPaste id={order.id} productCode={productCode} command={command} products={products} />
                  ),
                },
              ]}
            />
          </>
        )}
        {command.error && <CountingError error={command.error} />}
        <CountingRecords order={order} />
      </Flex>
    </Drawer>
  );
}
