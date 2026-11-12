import { useState } from 'react';
import { Button, Flex, Input, Table, Typography } from 'antd';
import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { RequestError } from '../../components/RequestError';
import { text } from './copy';
import { checkPaste, type PasteRow } from './paste-check';
import type { CountingCommand } from './use-counting-command';

export function CountingPaste({
  id,
  productCode,
  command,
  products,
}: {
  id: string;
  productCode: string;
  command: CountingCommand;
  products: { productCode: string; productName: string }[];
}) {
  const [value, setValue] = useState('');
  const [rows, setRows] = useState<PasteRow[]>([]);
  const [error, setError] = useState<unknown>();
  const lock = useSubmitLock();
  const valid = rows.filter((row) => row.state === 'valid');
  async function inspect() {
    setError(undefined);
    try {
      await lock.run(async () => {
        const additions = await checkPaste(id, value, productCode, rows);
        setRows([...rows, ...additions]);
        setValue('');
      });
    } catch (e) {
      setError(e);
    }
  }
  async function add() {
    try {
      const result = await command.run({
        kind: 'batch',
        input: { records: valid.map(({ barcode, productCode }) => ({ barcode, productCode })), source: 'paste' },
      });
      if (!result) return;
      let index = 0;
      setRows(
        rows.map((r) => {
          if (r.state !== 'valid') return r;
          const item = result.items[index++]!;
          return { ...r, state: item.ok ? 'saved' : 'failed', reason: item.reason };
        }),
      );
    } catch {
      /* Shared command error remains visible; retry keeps the same key. */
    }
  }
  return (
    <Flex vertical gap="small">
      <Input.TextArea
        aria-label={text.pasteLabel}
        placeholder={text.pasteLabel}
        value={value}
        disabled={lock.busy || command.busy}
        onChange={(e) => setValue(e.target.value)}
        autoSize={{ minRows: 3, maxRows: 8 }}
      />
      <Flex gap="small">
        <Button disabled={!value.trim() || command.busy} loading={lock.busy} onClick={() => void inspect()}>
          {text.inspect}
        </Button>
        <Button disabled={lock.busy || command.busy} onClick={() => setRows([])}>
          {text.clear}
        </Button>
      </Flex>
      {Boolean(error) && <RequestError error={error} />}
      <span>
        {text.valid} {valid.length} · {text.duplicate} {rows.filter((r) => r.state === 'duplicate').length} ·{' '}
        {text.invalid} {rows.filter((r) => r.state === 'invalid').length}
      </span>
      {rows.length > 0 && (
        <Table
          size="small"
          rowKey={(_, i) => String(i)}
          dataSource={rows}
          columns={[
            { title: text.barcode, dataIndex: 'barcode' },
            {
              title: text.product,
              render: (_, row) => (
                <>
                  <div>{products.find((p) => p.productCode === row.productCode)?.productName ?? text.unknown}</div>
                  <Typography.Text type="secondary">{row.productCode}</Typography.Text>
                </>
              ),
            },
            { title: text.result, dataIndex: 'reason' },
          ]}
        />
      )}
      <Button disabled={!valid.length || command.busy || lock.busy} loading={command.busy} onClick={() => void add()}>
        {text.count(valid.length)}
      </Button>
    </Flex>
  );
}
