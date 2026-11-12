import { Alert, Flex, Progress, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { tonnes, type ScanSummary } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { countingKeys } from './keys';
import { text } from './copy';

export function CountingProgress({ id }: { id: string }) {
  const { data, error } = useQuery(countingKeys.summary(id));
  if (error) return <RequestError error={error} />;
  if (!data) return null;
  return (
    <Flex vertical gap="small" data-testid="counting-progress">
      <Table
        size="small"
        pagination={false}
        rowKey="key"
        dataSource={[
          {
            key: 'packages',
            label: text.packages,
            planned: data.planned.packages,
            recorded: data.recorded.packages,
            difference: data.difference.packages,
          },
          {
            key: 'weight',
            label: text.tonnes,
            planned: tonnes(data.planned.weightGrams),
            recorded: tonnes(data.recorded.weightGrams),
            difference: tonnes(data.difference.weightGrams),
          },
        ]}
        columns={[
          { title: '', dataIndex: 'label' },
          { title: text.planned, dataIndex: 'planned' },
          { title: text.recorded, dataIndex: 'recorded' },
          { title: text.difference, dataIndex: 'difference' },
        ]}
      />
      <QuantityProgress data={data} />
      {data.difference.packages < 0 && <Alert type="warning" title={text.over(-data.difference.packages)} />}
    </Flex>
  );
}
function QuantityProgress({ data }: { data: ScanSummary }) {
  return (
    <Flex vertical>
      <span>{text.packages}</span>
      <Progress percent={percent(data.recorded.packages, data.planned.packages)} />
      <span>{text.tonnes}</span>
      <Progress percent={percent(data.recorded.weightGrams, data.planned.weightGrams)} />
    </Flex>
  );
}
function percent(value: number, total: number) {
  return total ? Math.min(100, Math.round((value / total) * 100)) : 0;
}
