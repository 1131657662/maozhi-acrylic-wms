import { useDeferredValue, useState } from 'react';
import { SCAN_FRAGMENT_MIN } from '@wms/contracts';
import { Button, Flex, Input, Select } from 'antd';
import { text, sourceText } from './copy';
import { Candidates } from './candidates';
import type { CountingCommand } from './use-counting-command';

export function CountingEntry({
  id,
  productCode,
  command,
}: {
  id: string;
  productCode: string;
  command: CountingCommand;
}) {
  const [value, setValue] = useState('');
  const [searched, setSearched] = useState('');
  const typed = useDeferredValue(value.trim());
  const query = searched || (typed.length >= SCAN_FRAGMENT_MIN ? typed : '');
  const [source, setSource] = useState<'manual' | 'scanner'>('manual');
  async function add() {
    if (!value.trim() || command.busy) return;
    try {
      await command.run({ kind: 'record', input: { barcode: value.trim(), productCode, source } });
      setValue('');
      setSearched('');
    } catch {
      /* The shared command error stays visible. */
    }
  }
  return (
    <Flex vertical gap="small">
      <Select
        aria-label={text.source}
        value={source}
        onChange={setSource}
        disabled={command.busy}
        options={(['manual', 'scanner'] as const).map((value) => ({ value, label: sourceText[value] }))}
      />
      <Input
        aria-label={text.input}
        placeholder={text.placeholder}
        value={value}
        disabled={command.busy}
        onChange={(e) => {
          setValue(e.target.value);
          setSearched('');
        }}
        onPressEnter={(e) => {
          if (!e.repeat) void add();
        }}
      />
      <Button disabled={!value.trim() || command.busy} onClick={() => setSearched(value.trim())}>
        {text.search}
      </Button>
      {query && (
        <Candidates key={`${productCode}:${query}`} id={id} productCode={productCode} query={query} command={command} />
      )}
    </Flex>
  );
}
