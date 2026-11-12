import { useState } from 'react';
import { Button, Flex, Table, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { tonnes, SCAN_CANDIDATE_PAGE_SIZE } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { countingKeys } from './keys';
import { text, attributionText, candidateStatusText } from './copy';
import type { CountingCommand } from './use-counting-command';

export function Candidates({
  id,
  productCode,
  query,
  command,
}: {
  id: string;
  productCode: string;
  query: string;
  command: CountingCommand;
}) {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<React.Key[]>([]);
  const { data, error, isFetching } = useQuery(countingKeys.candidates(id, { productCode, query, page }));
  async function add() {
    for (const barcode of selected) {
      try {
        await command.run({ kind: 'record', input: { barcode: String(barcode), productCode, source: 'search' } });
      } catch {
        break;
      }
    }
    setSelected([]);
  }
  return (
    <Flex vertical gap="small">
      {error && <RequestError error={error} />}
      <Table
        size="small"
        rowKey="barcode"
        dataSource={data?.items}
        loading={isFetching}
        pagination={{
          current: page,
          pageSize: SCAN_CANDIDATE_PAGE_SIZE,
          total: data?.total,
          showSizeChanger: false,
          onChange: (next) => {
            setPage(next);
            setSelected([]);
          },
        }}
        rowSelection={{
          selectedRowKeys: selected,
          onChange: setSelected,
          getCheckboxProps: (r) => ({ disabled: command.busy || r.status !== 'available' }),
        }}
        columns={[
          { title: text.barcode, dataIndex: 'barcode' },
          { title: text.spec, dataIndex: 'sourceSpec' },
          { title: text.weight, render: (_, r) => tonnes(r.weightGrams) },
          {
            title: text.result,
            render: (_, r) => (
              <>
                <div>{candidateStatusText[r.status]}</div>
                <Tag>{attributionText[r.attribution]}</Tag>
              </>
            ),
          },
        ]}
      />
      <Button disabled={!selected.length || command.busy} loading={command.busy} onClick={() => void add()}>
        {text.add}
      </Button>
    </Flex>
  );
}
